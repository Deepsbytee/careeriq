"""Password hashing (bcrypt) and JWT helpers.

bcrypt is called directly. The previous passlib wrapper breaks with newer bcrypt
releases, and the old code "handled" that by quietly storing plaintext passwords.
There is no plaintext path here: if hashing fails, the error is raised.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings

MAX_PASSWORD_BYTES = 72  # bcrypt's hard limit
_BCRYPT_PREFIXES = ("$2a$", "$2b$", "$2y$")


def is_bcrypt_hash(value: str | None) -> bool:
    return bool(value) and value.startswith(_BCRYPT_PREFIXES) and len(value) == 60


def get_password_hash(password: str) -> str:
    raw = password.encode("utf-8")
    if len(raw) > MAX_PASSWORD_BYTES:
        raise ValueError("password is longer than 72 bytes")
    return bcrypt.hashpw(raw, bcrypt.gensalt(rounds=12)).decode("ascii")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """True only for a real bcrypt match. A stored plaintext value never matches."""
    if not is_bcrypt_hash(hashed_password):
        return False
    raw = plain_password.encode("utf-8")
    if len(raw) > MAX_PASSWORD_BYTES:
        return False
    try:
        return bcrypt.checkpw(raw, hashed_password.encode("ascii"))
    except ValueError:
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None
