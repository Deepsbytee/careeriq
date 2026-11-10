"""Features for recruiter and admin accounts."""
from typing import List

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import require_role
from app.core.errors import DocumentError
from app.db.session import get_db
from app.models.models import JobMatch, Resume, ResumeAnalysis, User, UserRole
from app.services.screening import rank_candidates

screening_router = APIRouter(prefix="/screening", tags=["screening"])
admin_router = APIRouter(prefix="/admin", tags=["admin"])


@screening_router.post("/rank")
def rank(
    files: List[UploadFile] = File(...),
    job_title: str = Form(...),
    job_description: str = Form(...),
    _: User = Depends(require_role(UserRole.recruiter, UserRole.admin)),
):
    """Rank uploaded resumes against a job description. Nothing is stored."""
    if len(files) > settings.SCREENING_MAX_FILES:
        raise DocumentError(f"Upload at most {settings.SCREENING_MAX_FILES} resumes at a time.", code="TOO_MANY_FILES")
    loaded = [(f.filename or "resume", f.file.read(settings.max_upload_bytes + 1)) for f in files]
    return rank_candidates(loaded, job_title, job_description)


@admin_router.get("/overview")
def overview(db: Session = Depends(get_db), _: User = Depends(require_role(UserRole.admin))):
    by_role = dict(db.query(User.role, func.count(User.id)).group_by(User.role).all())
    return {
        "users": {r.value: by_role.get(r, 0) for r in UserRole},
        "resumes": db.query(Resume).count(),
        "analyses": db.query(ResumeAnalysis).count(),
        "job_matches": db.query(JobMatch).count(),
        "ai": {"provider": settings.ai_provider, "model": settings.ai_model, "configured": settings.ai_configured},
        "environment": settings.ENVIRONMENT,
        "demo_mode": settings.demo_enabled,
    }
