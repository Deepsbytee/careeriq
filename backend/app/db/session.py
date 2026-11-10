from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.core.config import settings


def _create_engine():
    url = settings.database_url_effective

    connect_args = {}
    if url.startswith("sqlite"):
        # Needed for SQLite when used with FastAPI/Threading.
        connect_args = {"check_same_thread": False}

    # For SQLite, pool_pre_ping can be harmless but unnecessary.
    return create_engine(url, pool_pre_ping=True, connect_args=connect_args)


engine = _create_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

