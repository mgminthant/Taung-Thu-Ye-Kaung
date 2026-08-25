"""Pydantic models = the JSON contract between the API and the Expo app.

FastAPI uses these to validate incoming requests and shape outgoing responses.
Keep them in sync with the mobile app's TypeScript types.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


# The 10-intent taxonomy (prd.md §8). Used by the LLM intent+NER stage and by
# the heuristic fallback so both produce the same labels.
INTENT_LABELS: tuple[str, ...] = (
    "GENERAL_INFORMATION",
    "CULTIVATION",
    "DISEASE_IDENTIFICATION",
    "DISEASE_TREATMENT",
    "PEST_CONTROL",
    "FERTILIZER",
    "WATER_MANAGEMENT",
    "HARVESTING",
    "PREVENTION",
    "OTHER",
)

IntentType = Literal[
    "GENERAL_INFORMATION",
    "CULTIVATION",
    "DISEASE_IDENTIFICATION",
    "DISEASE_TREATMENT",
    "PEST_CONTROL",
    "FERTILIZER",
    "WATER_MANAGEMENT",
    "HARVESTING",
    "PREVENTION",
    "OTHER",
]


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
    user_id: str | None = None  # device/user id for active user tracking


class IntentNerResult(BaseModel):
    """Structured output of the intent + NER stage (prd.md §8–§10).

    ``intent`` follows the 10-intent taxonomy. Entity fields carry the most
    salient mention (or None); values are normalized to lowercase English when
    possible so they can drive the retrieval query, crop filtering, and
    analytics — otherwise kept as written.
    """

    intent: IntentType = "OTHER"
    crop: str | None = None
    disease: str | None = None
    pest: str | None = None
    symptom: str | None = None
    fertilizer: str | None = None
    pesticide: str | None = None
    plant_part: str | None = None
    location: str | None = None


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
    intent: str | None = None       # e.g. "DISEASE_TREATMENT", "PEST_CONTROL", ...
    entities: IntentNerResult | None = None  # intent + NER stage output
    sources: list[RetrievedSource] = Field(default_factory=list)
    out_of_scope: bool = False      # True = we refused a non-farming question
    used_llm: bool = False          # True = answer came from the OpenRouter LLM
    needs_clarification: bool = False  # True = bot asked a follow-up for missing info
    insufficient_knowledge: bool = False  # True = honest "haven't learned that yet" reply
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
    # prd.md §16 extras (reason/comment asked on 👎; conversation ties the
    # rating to a chat). All optional so old clients keep working.
    conversation_id: str | None = None
    reason: str | None = None
    comment: str | None = None


class FeedbackResponse(BaseModel):
    """Body of the POST /feedback reply."""

    ok: bool = True


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


class HealthResponse(BaseModel):
    """Body of GET /health (used by the app's connection check + admin sync UI).

    ``source`` tells the admin whether the bot is serving the portal's SQLite
    articles or nothing; ``sqlite_path`` / ``sqlite_count`` / ``chroma_count``
    let you confirm the vector store is actually mirroring the portal DB.
    """

    status: str
    knowledge_count: int
    source: str = "sqlite"
    sqlite_path: str = ""
    sqlite_count: int = 0
    chroma_count: int = 0
    openrouter_configured: bool
    model: str


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


class RegisterRequest(BaseModel):
    """Body of POST /auth/register."""

    username: str = Field(min_length=3, max_length=30)
    password: str = Field(min_length=4, max_length=100)
    displayName: str = Field(min_length=1, max_length=50)


class LoginRequest(BaseModel):
    """Body of POST /auth/login."""

    username: str
    password: str


class GoogleAuthRequest(BaseModel):
    """Body of POST /auth/google (Google Sign-In via expo-auth-session).

    ``idToken`` is the Google-issued OIDC id_token from the mobile browser
    sheet; verified server-side against the tokeninfo endpoint.
    """

    idToken: str = Field(min_length=20)


class SyncRequest(BaseModel):
    """Body of POST /sync-knowledge (incremental KB sync from the portal).

    ``operation`` is one of ``create`` / ``update`` / ``delete`` / ``reload``;
    ``id`` is the article id that changed. When omitted, the backend falls back
    to a full reload of the SQLite knowledge base.
    """

    operation: str = "reload"
    id: str | None = None


class AuthResponse(BaseModel):
    """Body of POST /auth/register, /auth/login and /auth/google replies."""

    userId: str
    displayName: str
