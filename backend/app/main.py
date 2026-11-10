import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.errors import AppError
from app.core.ratelimit import RateLimitError
from app.core.security import get_password_hash
from app.db.migrate import ensure_columns, hash_plaintext_passwords
from app.db.session import Base, SessionLocal, engine
from app.models.models import User, UserRole

log = logging.getLogger("careeriq")

DEMO_USERS = (
    ("candidate@example.com", "Demo Candidate", UserRole.candidate),
    ("recruiter@example.com", "Demo Recruiter", UserRole.recruiter),
    ("admin@example.com", "Demo Admin", UserRole.admin),
)


def check_runtime_safety() -> None:
    """Refuse to run production with a guessable secret; warn loudly in development."""
    if settings.secret_key_is_weak:
        if settings.is_production:
            raise RuntimeError(
                "SECRET_KEY is missing or too weak. Set a random value of at least 32 characters: "
                'python -c "import secrets; print(secrets.token_urlsafe(48))"'
            )
        log.warning("SECRET_KEY is weak or default. Fine for local development, never for production.")
    if settings.is_production and settings.DEMO_MODE:
        log.warning("DEMO_MODE is on in production: demo accounts with a publicly known password exist.")


def seed_demo_users(db) -> int:
    """Create the demo accounts if missing. Never resets an existing account's password."""
    created = 0
    for email, name, role in DEMO_USERS:
        if not db.query(User).filter(User.email == email).first():
            db.add(User(email=email, full_name=name, role=role, is_active=True,
                        hashed_password=get_password_hash(settings.DEMO_PASSWORD)))
            created += 1
    if created:
        db.commit()
    return created


@asynccontextmanager
async def lifespan(_: FastAPI):
    check_runtime_safety()
    if settings.database_kind == "sqlite":
        settings.sqlite_path.parent.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    ensure_columns(engine)

    if settings.ai_configured:
        log.warning("AI ready: provider=%s model=%s", settings.ai_provider, settings.ai_model)
    else:
        log.warning("AI NOT configured (provider=%s). Analysis endpoints return 503 until the key is set in .env",
                    settings.ai_provider)

    db = SessionLocal()
    try:
        fixed = hash_plaintext_passwords(db)
        if fixed:
            log.warning("Security: converted %d plaintext password(s) to bcrypt hashes.", fixed)
        if settings.demo_enabled:
            seed_demo_users(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="CareerIQ API",
    version="2.0.0",
    description="AI-powered resume analysis and career intelligence",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1):\d+$" if not settings.is_production else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router)


@app.exception_handler(AppError)
async def app_error_handler(_: Request, exc: AppError):
    # `detail` keeps FastAPI's convention (a plain string); `code` is for the frontend.
    headers = {"Retry-After": str(exc.retry_after)} if isinstance(exc, RateLimitError) else None
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message, "code": exc.code}, headers=headers)


@app.exception_handler(RequestValidationError)
async def validation_handler(_: Request, exc: RequestValidationError):
    """One readable sentence instead of FastAPI's list of error objects."""
    first = exc.errors()[0] if exc.errors() else {}
    msg = str(first.get("msg", "Invalid request"))
    if msg.startswith("Value error, "):
        detail = msg.removeprefix("Value error, ")           # our own validator messages are full sentences
    else:
        field = ".".join(str(p) for p in first.get("loc", []) if p not in ("body", "query", "path"))
        detail = f"{field}: {msg}." if field else f"{msg}."
    return JSONResponse(status_code=422, content={"detail": detail, "code": "VALIDATION_ERROR"})


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "careeriq-api",
        "environment": settings.ENVIRONMENT,
        "demo_mode": settings.demo_enabled,
        "ai": {"provider": settings.ai_provider, "model": settings.ai_model, "configured": settings.ai_configured},
    }
