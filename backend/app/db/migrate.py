"""Tiny additive migration: add any model columns missing from existing tables.

``Base.metadata.create_all`` creates new tables but never alters existing ones,
so an older careeriq.db would break when a column is added to a model. This adds
the missing (nullable) columns on startup, for SQLite and PostgreSQL alike.
For larger schema changes, use Alembic.
"""
from __future__ import annotations

import logging

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session
from sqlalchemy.engine import Engine

from app.db.session import Base

log = logging.getLogger("careeriq.db")


def ensure_columns(engine: Engine) -> list[str]:
    added: list[str] = []
    insp = inspect(engine)
    existing_tables = set(insp.get_table_names())
    with engine.begin() as conn:
        for table in Base.metadata.sorted_tables:
            if table.name not in existing_tables:
                continue  # create_all handles brand-new tables
            have = {c["name"] for c in insp.get_columns(table.name)}
            for col in table.columns:
                if col.name in have:
                    continue
                if not col.nullable and col.default is None and col.server_default is None:
                    log.warning("Skipping non-nullable column %s.%s; needs a manual migration", table.name, col.name)
                    continue
                ddl_type = col.type.compile(dialect=engine.dialect)
                conn.execute(text(f'ALTER TABLE "{table.name}" ADD COLUMN "{col.name}" {ddl_type}'))
                added.append(f"{table.name}.{col.name}")
    if added:
        log.info("Added missing columns: %s", ", ".join(added))
    return added


def hash_plaintext_passwords(db: Session) -> int:
    """Upgrade accounts whose password was stored as plaintext to a bcrypt hash.

    Earlier versions fell back to storing the raw password when hashing failed.
    The stored value *is* the password, so it can be hashed in place without
    locking anyone out. Values bcrypt can't take (over 72 bytes) get an unusable
    hash, and the owner must reset the password.
    """
    import secrets

    from app.core.security import MAX_PASSWORD_BYTES, get_password_hash, is_bcrypt_hash
    from app.models.models import User

    fixed = 0
    for user in db.query(User).all():
        stored = user.hashed_password or ""
        if is_bcrypt_hash(stored):
            continue
        if stored and len(stored.encode("utf-8")) <= MAX_PASSWORD_BYTES:
            user.hashed_password = get_password_hash(stored)
        else:
            user.hashed_password = get_password_hash(secrets.token_urlsafe(32))
            log.warning("Account %s had an unusable stored password and needs a reset.", user.email)
        fixed += 1
    if fixed:
        db.commit()
    return fixed
