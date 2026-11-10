"""Small in-memory sliding-window rate limiter.

Protects login from password guessing and protects your AI quota (and bill) from
one user burning through it. State lives in this process, so it resets when the
server restarts and isn't shared between workers. For several workers or servers,
put the same rules in a shared store such as Redis or in your reverse proxy.
"""
from __future__ import annotations

import threading
import time
from collections import defaultdict, deque

from fastapi import Request

from app.core.config import settings
from app.core.errors import AppError


class RateLimitError(AppError):
    status_code = 429
    code = "RATE_LIMITED"

    def __init__(self, message: str, retry_after: int, *, code: str | None = None):
        super().__init__(message, code=code)
        self.retry_after = max(1, int(retry_after))


class RateLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str, limit: int, window_s: int, message: str, *, code: str | None = None) -> None:
        now = time.monotonic()
        with self._lock:
            q = self._hits[key]
            while q and now - q[0] >= window_s:
                q.popleft()
            if len(q) >= limit:
                raise RateLimitError(message, retry_after=window_s - (now - q[0]), code=code)
            q.append(now)

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


limiter = RateLimiter()


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:  # behind a proxy such as Render: the first address is the client
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def auth_rate_limit(request: Request) -> None:
    limiter.check(
        f"auth:{client_ip(request)}",
        settings.AUTH_ATTEMPTS_PER_MINUTE,
        60,
        "Too many attempts. Wait a minute and try again.",
        code="TOO_MANY_ATTEMPTS",
    )


def enforce_ai_quota(user_id: str) -> None:
    """Call right before an AI request (not for cached results)."""
    limiter.check(f"ai-burst:{user_id}", settings.AI_BURST_PER_MINUTE, 60,
                  "You're sending requests too quickly. Wait a moment and try again.", code="RATE_LIMITED")
    limiter.check(f"ai-day:{user_id}", settings.AI_DAILY_LIMIT, 86400,
                  f"You've reached today's limit of {settings.AI_DAILY_LIMIT} AI analyses. It resets within 24 hours.",
                  code="DAILY_LIMIT_REACHED")
