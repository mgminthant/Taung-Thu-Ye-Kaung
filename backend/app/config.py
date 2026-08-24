"""Central configuration, loaded from env vars / backend/.env.

Any value can be overridden with an environment variable (e.g.
``OPENROUTER_API_KEY=...``), or by adding the key to backend/.env
(see .env.example for the expected names).
"""
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/ directory itself; used to resolve the other paths below.
BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """Pydantic-settings model: reads env vars first, then backend/.env."""

    model_config = SettingsConfigDict(
        env_file=str(BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",  # ignore unknown keys so .env can hold unrelated vars
    )

    # --- LLM (OpenRouter) ---
    openrouter_api_key: str = ""   # set in backend/.env; empty = offline mode
    openrouter_model: str = "google/gemini-2.5-flash"
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    # Max OUTPUT tokens for the answer model. Gemini 2.5 Flash is a *thinking*
    # model: thinking tokens eat the output budget and OpenRouter's default cap
    # can truncate long answers. Raise the cap and disable thinking (see llm.py)
    # so the whole budget is the answer. Override with OPENROUTER_MAX_TOKENS.
    openrouter_max_tokens: int = 4096
    # Cheaper/faster model for the agriculture gate + intent/NER stage. Kept on
    # gpt-4o-mini for deterministic structured verdicts; the answer model is the
    # Gemini one above. Empty = reuse openrouter_model.
    openrouter_filter_model: str = "openai/gpt-4o-mini"

    # --- App ---
    app_name: str = "Taung Thu Ye Khaung"
    cors_origins: str = "*"        # comma-separated list, or "*" for all

    # --- Google Sign-In ---
    # OAuth client IDs (comma-separated) that may appear as aud in the
    # id_token posted to /auth/google. The mobile app uses one native client
    # per platform (iOS + Android), so both IDs belong here.
    # Empty = Google sign-in disabled (/auth/google returns 503).
    google_client_ids: str = ""

    @property
    def google_client_id_list(self) -> list[str]:
        return [s.strip() for s in self.google_client_ids.split(",") if s.strip()]

    # --- Knowledge base ---
    # SQLite DB the web admin portal writes to (Prisma dev.db). The backend
    # reads articles from here; override with SQLITE_DB_PATH if it lives
    # somewhere other than ../web/dev.db.
    sqlite_db_path: str = ""
    retrieval_top_k: int = 3          # records returned/used as context

    # --- Semantic search (vector store) ---
    embedding_model: str = "intfloat/multilingual-e5-small"
    vector_store_path: str = str(BACKEND_DIR / "chroma_store")
    # Cross-encoder re-ranks dense candidates and decides "match vs no match".
    rerank_model: str = "cross-encoder/mmarco-mMiniLMv2-L12-H384-v1"
    semantic_candidate_k: int = 8  # dense candidates pulled before re-ranking
    # Relevance logit above this = strong knowledge match.
    min_semantic_score: float = 0.0


settings = Settings()
