"""FastAPI application: HTTP routes only.

All chat logic lives in rag.py (RagPipeline); this file only wires the
endpoints, CORS, and startup bootstrap. Keep it thin.
"""
from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .classify import classify_article
from .config import settings
from .database import (
    authenticate_user,
    log_chat,
    log_feedback,
    register_user,
    upsert_google_user,
)
from .rag import RagPipeline
from .schemas import (
    AuthResponse,
    ChatMessage,
    ChatRequest,
    ChatResponse,
    FeedbackRequest,
    FeedbackResponse,
    GoogleAuthRequest,
    HealthResponse,
    LoginRequest,
    RegisterRequest,
    SyncRequest,
)
from .normalize import normalize_myanmar
from .sqlite_loader import (
    db_path,
    load_knowledge_from_sqlite,
    load_knowledge_record_by_id,
    quick_signature,
)
from .vectorstore import VectorStore

# Feedback responses are appended here as JSON-lines for later analysis.
FEEDBACK_PATH = Path(__file__).resolve().parent.parent / "feedback.jsonl"


def _load_knowledge():
    """Load articles from the portal's SQLite DB (the only source of truth).

    CSV is no longer used. If SQLite is empty the bot simply has no knowledge
    (and logs a clear warning) instead of silently serving stale CSV content.
    """
    records = load_knowledge_from_sqlite()
    if records:
        print(f"[startup] Loaded {len(records)} articles from SQLite ({db_path()})")
    else:
        print(
            f"[startup] WARNING: no articles in SQLite ({db_path()}). "
            "The bot will have no knowledge until articles are added in the "
            "admin portal and synced."
        )
    return records


def _fingerprint_knowledge(records):
    """Content-aware fingerprint so edits are detected, not just add/delete.

    Hashes each record's full change signature (id + updatedAt + title +
    content + category + crop + tags + language). The old version hashed only
    IDs, so an edited article (same id) was never re-indexed by the running
    backend — the bot kept answering from stale vectors until a full restart.
    """
    import hashlib
    sigs = sorted(r.change_signature() for r in records)
    return hashlib.md5("\n".join(sigs).encode("utf-8")).hexdigest()


# ----------------------------------------------------------------------
# Startup bootstrap: load the knowledge base and build the vector index.
# Models are downloaded once on first run and cached in backend/chroma_store.
# ----------------------------------------------------------------------
knowledge = _load_knowledge()
_kb_fingerprint = _fingerprint_knowledge(knowledge)
_kb_quick_fp = quick_signature()
vector_store = VectorStore(
    persist_dir=settings.vector_store_path,
    embedding_model=settings.embedding_model,
)
vector_store.ensure_indexed(knowledge)

pipeline = RagPipeline(knowledge, vector_store)

app = FastAPI(title=settings.app_name, version="0.1.0")

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Liveness probe used by the mobile app on launch.

    Also reports whether the vector store is actually mirroring the portal's
    SQLite DB, so an admin can spot sync drift at a glance.
    """
    try:
        chroma_count = vector_store._get_collection().count()
    except Exception:
        chroma_count = -1
    try:
        sqlite_count = len(load_knowledge_from_sqlite())
    except Exception:
        sqlite_count = -1
    return HealthResponse(
        status="ok",
        knowledge_count=len(knowledge),
        source="sqlite",
        sqlite_path=str(db_path()),
        sqlite_count=sqlite_count,
        chroma_count=chroma_count,
        openrouter_configured=bool(settings.openrouter_api_key),
        model=settings.openrouter_model,
    )


@app.post("/auth/register", response_model=AuthResponse)
def auth_register(body: RegisterRequest) -> AuthResponse:
    """Register a new user account."""
    result = register_user(
        username=body.username.strip().lower(),
        display_name=body.displayName.strip(),
        password=body.password,
    )
    if isinstance(result, str):
        raise HTTPException(status_code=409, detail=result)
    return AuthResponse(**result)


@app.post("/auth/login", response_model=AuthResponse)
def auth_login(body: LoginRequest) -> AuthResponse:
    """Authenticate an existing user."""
    result = authenticate_user(
        username=body.username.strip().lower(),
        password=body.password,
    )
    if isinstance(result, str):
        raise HTTPException(status_code=401, detail=result)
    return AuthResponse(**result)


@app.post("/auth/google", response_model=AuthResponse)
def auth_google(body: GoogleAuthRequest) -> AuthResponse:
    """Google Sign-In: verify the mobile app's id_token, then find-or-create.

    Verification uses Google's tokeninfo endpoint (httpx is already a dep —
    no extra JWT library needed). Checks audience, issuer and expiry; only
    verified emails are accepted.
    """
    if not settings.google_client_id_list:
        raise HTTPException(
            status_code=503,
            detail="Google Sign-In is not configured on the server",
        )

    import httpx as _httpx

    try:
        resp = _httpx.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": body.idToken},
            timeout=10.0,
        )
        info = resp.json()
    except (_httpx.HTTPError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid Google token")

    if resp.status_code != 200 or "error" in info:
        raise HTTPException(status_code=401, detail="Invalid Google token")
    if info.get("aud") not in settings.google_client_id_list:
        raise HTTPException(status_code=401, detail="Invalid Google token")
    if info.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise HTTPException(status_code=401, detail="Invalid Google token")

    exp = int(info.get("exp", "0"))
    if datetime.now(timezone.utc).timestamp() >= exp:
        raise HTTPException(status_code=401, detail="Google token expired")

    email = (info.get("email") or "").strip().lower()
    if not email or info.get("email_verified", "false").lower() != "true":
        raise HTTPException(status_code=401, detail="Google email not verified")

    display_name = (info.get("name") or email.split("@", 1)[0])[:50]
    result = upsert_google_user(email=email, display_name=display_name)
    return AuthResponse(**result)


@app.post("/sync-knowledge")
def sync_knowledge(body: SyncRequest = None):
    """Keep the vector index in sync with the portal's SQLite after a CRUD edit.

    Called by the admin portal after any article create/update/delete. When
    ``body`` carries ``{operation, id}`` we apply just that one record
    incrementally (embed/delete a single article instead of re-indexing the
    whole KB). When ``body`` is omitted (or ``id`` is missing) we fall back to
    a full reload — used by the seed script and manual DB edits.

    Never 500s on an empty DB — an empty portal just means an empty bot, and
    the portal needs the counts to know sync succeeded.
    """
    global knowledge, pipeline, _kb_fingerprint, _kb_quick_fp

    operation = (body.operation if body else None) or "reload"
    article_id = (body.id if body else None) or None

    # ----- Incremental path: a single known article changed. -----
    if operation in ("create", "update") and article_id:
        record = load_knowledge_record_by_id(article_id)
        if record is None:
            # Article gone (deleted before sync finished) — do a safe full reload.
            return _full_reload()
        vector_store.upsert_record(record)
        idx = next((i for i, r in enumerate(knowledge) if r.id == article_id), -1)
        if idx >= 0:
            knowledge[idx] = record
        else:
            knowledge.append(record)
        pipeline = RagPipeline(knowledge, vector_store)
        _kb_fingerprint = _fingerprint_knowledge(knowledge)
        _kb_quick_fp = quick_signature()
        return {
            "ok": True,
            "operation": operation,
            "id": article_id,
            "count": len(knowledge),
            "chroma_count": vector_store._get_collection().count(),
        }

    if operation == "delete" and article_id:
        vector_store.delete_record(article_id)
        knowledge = [r for r in knowledge if r.id != article_id]
        pipeline = RagPipeline(knowledge, vector_store)
        _kb_fingerprint = _fingerprint_knowledge(knowledge)
        _kb_quick_fp = quick_signature()
        return {
            "ok": True,
            "operation": "delete",
            "id": article_id,
            "count": len(knowledge),
            "chroma_count": vector_store._get_collection().count(),
        }

    # ----- Fallback path: full reload (seed, manual edits, unknown id). -----
    return _full_reload()


def _full_reload():
    global knowledge, pipeline, _kb_fingerprint, _kb_quick_fp
    new_records = load_knowledge_from_sqlite()
    if not new_records:
        return {"ok": True, "count": 0, "source": "sqlite", "note": "SQLite has no articles"}
    knowledge = new_records
    vector_store.ensure_indexed(knowledge)
    pipeline = RagPipeline(knowledge, vector_store)
    _kb_fingerprint = _fingerprint_knowledge(knowledge)
    _kb_quick_fp = quick_signature()
    return {
        "ok": True,
        "count": len(knowledge),
        "source": "sqlite",
        "chroma_count": vector_store._get_collection().count(),
    }


@app.post("/classify-article")
async def classify(title: str = "", content: str = "", language: str = "en"):
    """Use LLM to suggest categories, crops, and tags for an article."""
    if not title.strip():
        raise HTTPException(status_code=400, detail="title is required")
    if not content.strip():
        raise HTTPException(status_code=400, detail="content is required")

    try:
        result = await classify_article(title, content, language=language)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Classification failed: {exc}")

    return result


@app.post("/classify-article/batch")
async def classify_batch():
    """Reclassify all articles in SQLite using LLM."""
    from .database import _connect

    conn = _connect()
    try:
        rows = conn.execute(
            "SELECT id, title, content FROM Article ORDER BY id"
        ).fetchall()
    finally:
        conn.close()

    results = []
    for row in rows:
        article_id, title, content = row[0], row[1], row[2]
        try:
            classified = await classify_article(title, content or "")
            results.append({"id": article_id, **classified})
        except Exception as exc:
            results.append({"id": article_id, "error": str(exc)})

    return {"count": len(results), "results": results}


def _maybe_reload_knowledge():
    """Check if SQLite knowledge changed since last load; rebuild pipeline if so.

    Uses a cheap row-count + latest-update signature first, so the full KB
    (all article content) is only re-read and re-fingerprinted when something
    actually changed — not on every chat request.
    """
    global knowledge, pipeline, _kb_fingerprint, _kb_quick_fp

    quick = quick_signature()
    if quick is not None and quick == _kb_quick_fp and _kb_fingerprint is not None:
        return
    _kb_quick_fp = quick

    sqlite_records = load_knowledge_from_sqlite()
    if not sqlite_records:
        return

    fp = _fingerprint_knowledge(sqlite_records)
    if fp == _kb_fingerprint:
        return

    print(f"[auto-reload] Knowledge changed in SQLite, rebuilding pipeline ({len(sqlite_records)} articles)")
    knowledge = sqlite_records
    _kb_fingerprint = fp
    vector_store.ensure_indexed(knowledge)
    pipeline = RagPipeline(knowledge, vector_store)


@app.post("/chat", response_model=ChatResponse)
async def chat(body: ChatRequest) -> ChatResponse:
    """Answer a farming question via the RAG pipeline."""
    _maybe_reload_knowledge()

    question = normalize_myanmar(body.message.strip())
    if not question:
        raise HTTPException(status_code=400, detail="Message is empty")

    # Normalize history too so the gate / NER / embedding see Unicode.
    history = [
        ChatMessage(role=h.role, content=normalize_myanmar(h.content))
        for h in body.history
    ]

    t0 = time.perf_counter()
    result = await pipeline.answer(question, history)
    elapsed_ms = int((time.perf_counter() - t0) * 1000)

    # Log every chat interaction to SQLite for admin analytics.
    try:
        log_chat(
            question=question,
            answer=result.answer,
            intent=result.intent,
            entities=result.entities.model_dump() if result.entities else None,
            out_of_scope=result.out_of_scope,
            used_llm=result.used_llm,
            source_ids=[s.id for s in result.sources],
            response_ms=elapsed_ms,
            user_id=body.user_id,
        )
    except Exception:
        pass  # best-effort — never block the chat response

    return result


@app.post("/chat/stream")
async def chat_stream(body: ChatRequest):
    """Stream a farming answer as Server-Sent Events.

    Emits ``data: {"type":"token","text":"..."}`` chunks as the answer is
    generated, then a final ``data: {"type":"done","payload":{...}}`` carrying the
    same metadata a normal /chat returns (sources, intent, entities, ...). The
    client should concatenate the token texts for the live view and swap in
    ``payload.answer`` (already formatted) when ``done`` arrives.
    """
    _maybe_reload_knowledge()

    question = normalize_myanmar(body.message.strip())
    if not question:
        raise HTTPException(status_code=400, detail="Message is empty")

    # Normalize history too so the gate / NER / embedding see Unicode.
    history = [
        ChatMessage(role=h.role, content=normalize_myanmar(h.content))
        for h in body.history
    ]

    async def event_gen():
        final = None
        try:
            async for ev in pipeline.answer_stream(question, history):
                if ev.get("type") == "done":
                    final = ev["payload"]
                yield f"data: {json.dumps(ev, ensure_ascii=False)}\n\n"
        finally:
            if final is not None:
                try:
                    log_chat(
                        question=question,
                        answer=final.get("answer"),
                        intent=final.get("intent"),
                        entities=final.get("entities"),
                        out_of_scope=final.get("out_of_scope", False),
                        used_llm=final.get("used_llm", False),
                        source_ids=[s["id"] for s in (final.get("sources") or [])],
                        user_id=body.user_id,
                    )
                except Exception:
                    pass  # best-effort — never block the stream

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/feedback", response_model=FeedbackResponse)
def feedback(body: FeedbackRequest) -> FeedbackResponse:
    """Persist feedback to SQLite (portal reads this) + JSONL (backup)."""
    # Write to SQLite so admin portal shows real feedback.
    try:
        log_feedback(
            message=body.message,
            answer=body.answer,
            useful=body.useful,
            source_ids=body.source_ids,
            reason=body.reason,
            comment=body.comment,
            conversation_id=body.conversation_id,
        )
    except Exception:
        pass

    # Also append to JSONL as backup.
    FEEDBACK_PATH.parent.mkdir(parents=True, exist_ok=True)
    row = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "useful": body.useful,
        "message": body.message,
        "answer": body.answer,
        "source_ids": body.source_ids,
        "reason": body.reason,
        "comment": body.comment,
        "conversation_id": body.conversation_id,
    }
    with FEEDBACK_PATH.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(row, ensure_ascii=False) + "\n")

    return FeedbackResponse(ok=True)
