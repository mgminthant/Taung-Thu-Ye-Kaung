"""Pydantic models = the JSON contract between the API and the Expo app.

FastAPI uses these to validate incoming requests and shape outgoing responses.
Keep them in sync with the mobile app's TypeScript types.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Chat
# ---------------------------------------------------------------------------


class ChatMessage(BaseModel):
    """One turn of the conversation history sent by the client."""

    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    """Body of POST /chat."""

    message: str = Field(min_length=1, max_length=2000)
    history: list[ChatMessage] = Field(default_factory=list, max_length=10)


class RetrievedSource(BaseModel):
    """A knowledge article that supported the answer (shown to the user).

    ``topic`` is kept under its historical name for the mobile app, but now
    carries the article's ``category`` (disease / pest / fertilizer / ...).
    """

    id: str
    crop: str
    topic: str
    score: float  # 0..1 cosine similarity, for display only
    question: str  # legacy name; carries the article title


class ChatResponse(BaseModel):
    """Body of the POST /chat reply."""

    answer: str
    crop: str | None = None
    topic: str | None = None        # now the matched article's category
    intent: str | None = None       # e.g. "pest", "plant_disease", ...
    sources: list[RetrievedSource] = Field(default_factory=list)
    out_of_scope: bool = False      # True = we refused a non-farming question
    used_llm: bool = False          # True = answer came from the OpenRouter LLM
    model: str | None = None        # model name that produced the answer


# ---------------------------------------------------------------------------
# Feedback
# ---------------------------------------------------------------------------


class FeedbackRequest(BaseModel):
    """Body of POST /feedback (thumbs up/down from the mobile app)."""

    message: str
    answer: str
    useful: bool
    source_ids: list[str] = Field(default_factory=list)


class FeedbackResponse(BaseModel):
    """Body of the POST /feedback reply."""

    ok: bool = True


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


class HealthResponse(BaseModel):
    """Body of GET /health (used by the app's connection check)."""

    status: str
    knowledge_count: int
    openrouter_configured: bool
    model: str
