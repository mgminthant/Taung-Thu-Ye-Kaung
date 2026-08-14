"""FastAPI application: HTTP routes only.

All chat logic lives in rag.py (RagPipeline); this file only wires the
endpoints, CORS, and startup bootstrap. Keep it thin.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .knowledge import load_knowledge
from .rag import RagPipeline
from .schemas import (
    ChatRequest,
    ChatResponse,
    FeedbackRequest,
    FeedbackResponse,
    HealthResponse,
)
from .vectorstore import VectorStore

# Feedback responses are appended here as JSON-lines for later analysis.
FEEDBACK_PATH = Path(__file__).resolve().parent.parent / "feedback.jsonl"


# ----------------------------------------------------------------------
# Startup bootstrap: load the knowledge base and build the vector index.
# Models are downloaded once on first run and cached in backend/chroma_store.
# ----------------------------------------------------------------------
knowledge = load_knowledge(settings.knowledge_csv_path)
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
    """Liveness probe used by the mobile app on launch."""
    return HealthResponse(
        status="ok",
        knowledge_count=len(knowledge),
        openrouter_configured=bool(settings.openrouter_api_key),
        model=settings.openrouter_model,
    )


@app.post("/chat", response_model=ChatResponse)
async def chat(body: ChatRequest) -> ChatResponse:
    """Answer a farming question via the RAG pipeline."""
    question = body.message.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Message is empty")

    # All decision logic (retrieval, no-knowledge reply, LLM degradation)
    # lives inside RagPipeline.answer; the HTTP layer just forwards the result.
    return await pipeline.answer(question, body.history)


@app.post("/feedback", response_model=FeedbackResponse)
def feedback(body: FeedbackRequest) -> FeedbackResponse:
    """Persist a thumbs-up/down + source ids for later quality analysis."""
    FEEDBACK_PATH.parent.mkdir(parents=True, exist_ok=True)
    row = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "useful": body.useful,
        "message": body.message,
        "answer": body.answer,
        "source_ids": body.source_ids,
    }
    with FEEDBACK_PATH.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(row, ensure_ascii=False) + "\n")
    return FeedbackResponse(ok=True)
