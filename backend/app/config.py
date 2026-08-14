"""Central configuration, loaded from env vars / backend/.env.

Any value can be overridden with an environment variable (e.g.
``OPENROUTER_API_KEY=...``), or by adding the key to backend/.env
(see .env.example for the expected names).
"""
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/ directory itself; used to resolve the other paths below.
BACKEND_DIR = Path(__file__).resolve().parent.parent

# Default knowledge base = the Myanmar CSV in the repo-root data/ folder.
DEFAULT_CSV = BACKEND_DIR.parent / "data" / "agriculture.csv"


class Settings(BaseSettings):
    """Pydantic-settings model: reads env vars first, then backend/.env."""

    model_config = SettingsConfigDict(
        env_file=str(BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",  # ignore unknown keys so .env can hold unrelated vars
    )

    # --- LLM (OpenRouter) ---
    openrouter_api_key: str = ""   # set in backend/.env; empty = offline mode
    openrouter_model: str = "openai/gpt-4o-mini"
    openrouter_base_url: str = "https://openrouter.ai/api/v1"

    # --- App ---
    app_name: str = "Taung Thu Ye Khaung"
    cors_origins: str = "*"        # comma-separated list, or "*" for all

    # --- Knowledge base + lexical retrieval ---
    knowledge_csv_path: str = str(DEFAULT_CSV)
    retrieval_top_k: int = 3          # records returned/used as context
    min_retrieval_score: float = 0.08 # minimum lexical score to count as a hit

    # --- Semantic search (vector store) ---
    embedding_model: str = "intfloat/multilingual-e5-small"
    vector_store_path: str = str(BACKEND_DIR / "chroma_store")
    # Cross-encoder re-ranks dense candidates and decides "match vs no match".
    rerank_model: str = "cross-encoder/mmarco-mMiniLMv2-L12-H384-v1"
    semantic_candidate_k: int = 8  # dense candidates pulled before re-ranking
    # Relevance logit above this = strong knowledge match.
    min_semantic_score: float = 0.0


settings = Settings()
