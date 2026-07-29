from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .knowledge import load_knowledge
from .llm import OUT_OF_SCOPE_REPLY, generate_answer, strip_markdown_noise
from .retrieval import (
    format_context,
    guess_intent,
    looks_like_farming,
    retrieve,
    structured_from_record,
)
from .schemas import (
    ChatRequest,
    ChatResponse,
    FeedbackRequest,
    FeedbackResponse,
    HealthResponse,
    RetrievedSource,
)

FEEDBACK_PATH = Path(__file__).resolve().parent.parent / "feedback.jsonl"

knowledge = load_knowledge(settings.knowledge_csv_path)

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
    return HealthResponse(
        status="ok",
        knowledge_count=len(knowledge),
        openrouter_configured=bool(settings.openrouter_api_key),
        model=settings.openrouter_model,
    )


@app.post("/chat", response_model=ChatResponse)
async def chat(body: ChatRequest) -> ChatResponse:
    question = body.message.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Message is empty")

    scored = retrieve(question, knowledge, top_k=settings.retrieval_top_k)
    strong = [item for item in scored if item.score >= settings.min_retrieval_score]
    top = strong[0].record if strong else None

    farming = looks_like_farming(question) or bool(strong) or bool(body.history)
    if not farming:
        return ChatResponse(
            answer=OUT_OF_SCOPE_REPLY,
            intent="out_of_scope",
            out_of_scope=True,
            used_llm=False,
            sources=[],
        )

    sources = [
        RetrievedSource(
            id=item.record.id,
            crop=item.record.crop,
            topic=item.record.topic,
            score=round(item.score, 3),
            question=item.record.question,
        )
        for item in strong
    ]

    intent = guess_intent(question, top)
    crop = top.crop if top else None
    topic = top.topic if top else None
    context = format_context(strong)
    has_strong_match = bool(strong)

    if settings.openrouter_api_key:
        try:
            answer = await generate_answer(
                question=question,
                context=context,
                history=body.history,
                has_strong_match=has_strong_match,
            )
            return ChatResponse(
                answer=strip_markdown_noise(answer),
                crop=crop,
                topic=topic,
                intent=intent,
                sources=sources,
                out_of_scope=False,
                used_llm=True,
                model=settings.openrouter_model,
            )
        except Exception as exc:  # noqa: BLE001 - fall back to retrieval answer
            if top is not None:
                return ChatResponse(
                    answer=structured_from_record(top)
                    + f"\n\n_(LLM unavailable: {exc})_",
                    crop=crop,
                    topic=topic,
                    intent=intent,
                    sources=sources,
                    out_of_scope=False,
                    used_llm=False,
                    model=None,
                )
            raise HTTPException(status_code=502, detail=f"OpenRouter error: {exc}") from exc

    # No API key: retrieval-only mode for local demos
    if top is not None:
        return ChatResponse(
            answer=structured_from_record(top),
            crop=crop,
            topic=topic,
            intent=intent,
            sources=sources,
            out_of_scope=False,
            used_llm=False,
            model=None,
        )

    return ChatResponse(
        answer=(
            "I could not find matching farming knowledge for that question yet. "
            "Try asking about rice, tomato, chili, pests, fertilizer, or watering. "
            "Add OPENROUTER_API_KEY to enable full AI answers."
        ),
        intent=intent,
        out_of_scope=False,
        used_llm=False,
        sources=[],
    )


@app.post("/feedback", response_model=FeedbackResponse)
def feedback(body: FeedbackRequest) -> FeedbackResponse:
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
