"""Application-level errors that map cleanly to HTTP responses.

Every error carries a stable machine-readable ``code`` (for the frontend) and
a human-readable ``message`` (shown to the user as-is).
"""
from __future__ import annotations


class AppError(Exception):
    status_code: int = 400
    code: str = "APP_ERROR"

    def __init__(self, message: str, *, code: str | None = None, status_code: int | None = None):
        super().__init__(message)
        self.message = message
        if code:
            self.code = code
        if status_code:
            self.status_code = status_code


class DocumentError(AppError):
    """The uploaded file (or pasted text) can't be used."""

    status_code = 422
    code = "INVALID_DOCUMENT"


class NotAResumeError(DocumentError):
    code = "NOT_A_RESUME"


class AIError(AppError):
    """Something went wrong talking to the AI provider."""

    status_code = 502
    code = "AI_ERROR"


class AINotConfiguredError(AIError):
    status_code = 503
    code = "AI_NOT_CONFIGURED"


class AIBusyError(AIError):
    status_code = 503
    code = "AI_BUSY"


class AIBadResponseError(AIError):
    status_code = 502
    code = "AI_BAD_RESPONSE"


class ExternalServiceError(AppError):
    status_code = 502
    code = "EXTERNAL_SERVICE_ERROR"


class ForbiddenError(AppError):
    status_code = 403
    code = "FORBIDDEN"
