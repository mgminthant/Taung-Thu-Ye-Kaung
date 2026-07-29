from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    history: list[ChatMessage] = Field(default_factory=list, max_length=10)


class RetrievedSource(BaseModel):
    id: str
    crop: str
    topic: str
    score: float
    question: str


class ChatResponse(BaseModel):
    answer: str
    crop: str | None = None
    topic: str | None = None
    intent: str | None = None
    sources: list[RetrievedSource] = Field(default_factory=list)
    out_of_scope: bool = False
    used_llm: bool = False
    model: str | None = None


class FeedbackRequest(BaseModel):
    message: str
    answer: str
    useful: bool
    source_ids: list[str] = Field(default_factory=list)


class FeedbackResponse(BaseModel):
    ok: bool = True


class HealthResponse(BaseModel):
    status: str
    knowledge_count: int
    openrouter_configured: bool
    model: str
