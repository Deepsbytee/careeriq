from __future__ import annotations

from pathlib import Path
from typing import List, Optional

from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/app/core/config.py -> parents[2] = backend/, parents[3] = repo root
BACKEND_DIR = Path(__file__).resolve().parents[2]
REPO_DIR = Path(__file__).resolve().parents[3]

# Absolute paths, so the .env is found no matter which folder uvicorn is
# started from. Later files override earlier ones (backend/.env wins).
ENV_FILES = (str(REPO_DIR / ".env"), str(BACKEND_DIR / ".env"))


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILES, extra="ignore")

    # Database (falls back to SQLite when empty)
    DATABASE_URL: Optional[str] = None

    # "development" or "production". Production enforces a real SECRET_KEY and turns demo accounts off.
    ENVIRONMENT: str = "development"
    # Demo accounts (candidate@/recruiter@/admin@example.com). None = on in development, off in production.
    DEMO_MODE: Optional[bool] = None
    DEMO_PASSWORD: str = "DemoPass123!"

    # Security / JWT
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    BACKEND_CORS_ORIGINS: str = "http://localhost:5173"

    # ── AI provider ──────────────────────────────────────────
    # gemini | ollama | openai | anthropic
    AI_PROVIDER: str = "gemini"
    AI_TIMEOUT_SECONDS: float = 60.0
    AI_MAX_RETRIES: int = 2

    GEMINI_API_KEY: str = ""
    # "gemini-flash-latest" always points at the current Flash model, so it
    # doesn't break when Google retires a version. Pin a specific one if you like.
    GEMINI_MODEL: str = "gemini-flash-latest"

    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.1"

    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"

    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = "claude-haiku-5-5"

    # ── Uploads ──────────────────────────────────────────────
    MAX_UPLOAD_MB: int = 5
    MAX_RESUME_PAGES: int = 6
    MAX_RESUME_WORDS: int = 4000

    # ── Abuse protection (per process; see app/core/ratelimit.py) ─
    AUTH_ATTEMPTS_PER_MINUTE: int = 10     # login/register attempts per IP
    AI_BURST_PER_MINUTE: int = 8           # AI calls per user per minute
    AI_DAILY_LIMIT: int = 40               # AI calls per user per day
    SCREENING_MAX_FILES: int = 15

    # Optional: raises GitHub's rate limit from 60 to 5000 requests/hour.
    GITHUB_TOKEN: str = ""

    # ── Derived ──────────────────────────────────────────────
    @property
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.BACKEND_CORS_ORIGINS.split(",") if o.strip()]

    @property
    def sqlite_path(self) -> Path:
        return BACKEND_DIR / "careeriq.db"

    @property
    def database_url_effective(self) -> str:
        if self.DATABASE_URL and self.DATABASE_URL.strip():
            return self.DATABASE_URL
        return f"sqlite:///{self.sqlite_path.as_posix()}"

    @property
    def database_kind(self) -> str:
        url = (self.database_url_effective or "").lower()
        if url.startswith(("postgresql", "postgres")):
            return "postgres"
        if url.startswith("sqlite"):
            return "sqlite"
        return "unknown"

    @property
    def ai_provider(self) -> str:
        return (self.AI_PROVIDER or "gemini").strip().lower()

    @property
    def ai_model(self) -> str:
        return {
            "gemini": self.GEMINI_MODEL,
            "ollama": self.OLLAMA_MODEL,
            "openai": self.OPENAI_MODEL,
            "anthropic": self.ANTHROPIC_MODEL,
        }.get(self.ai_provider, "")

    @property
    def ai_configured(self) -> bool:
        p = self.ai_provider
        if p == "gemini":
            return bool(self.GEMINI_API_KEY.strip())
        if p == "openai":
            return bool(self.OPENAI_API_KEY.strip())
        if p == "anthropic":
            return bool(self.ANTHROPIC_API_KEY.strip())
        if p == "ollama":
            return bool(self.OLLAMA_BASE_URL.strip())
        return False

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.strip().lower() == "production"

    @property
    def demo_enabled(self) -> bool:
        return (not self.is_production) if self.DEMO_MODE is None else bool(self.DEMO_MODE)

    @property
    def secret_key_is_weak(self) -> bool:
        return self.SECRET_KEY in ("", "change-me-in-production") or len(self.SECRET_KEY) < 32

    @property
    def max_upload_bytes(self) -> int:
        return self.MAX_UPLOAD_MB * 1024 * 1024


settings = Settings()
