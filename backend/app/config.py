from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
DEFAULT_CSV = BACKEND_DIR.parent / "data" / "agriculture_qa.csv"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    openrouter_api_key: str = ""
    openrouter_model: str = "openai/gpt-4o-mini"
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    app_name: str = "Taung Thu Ye Khaung"
    cors_origins: str = "*"
    knowledge_csv_path: str = str(DEFAULT_CSV)
    retrieval_top_k: int = 3
    min_retrieval_score: float = 0.08


settings = Settings()
