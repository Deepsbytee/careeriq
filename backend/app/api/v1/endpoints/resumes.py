from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user
from app.core.errors import NotAResumeError
from app.core.ratelimit import enforce_ai_quota
from app.db.session import get_db
from app.models.models import Resume, ResumeAnalysis, User
from app.schemas.schemas import AnalysisOut, ResumeDetail, ResumeOut
from app.services.ai_service import PROMPT_VERSION, analyze_resume, rewrite_bullets
from app.services.document_parser import parse_upload
from app.services.report import build_report_pdf
from app.services.resume_gate import require_resume
from app.services.resume_insights import six_second_scan

router = APIRouter(prefix="/resumes", tags=["resumes"])

_ANALYSIS_FIELDS = (
    "ats_score", "skills", "education", "experience", "keywords", "strengths", "weaknesses",
    "recommendations", "score_breakdown", "evidence", "summary", "prompt_version", "raw_result",
)


def _own_resume(db: Session, user: User, resume_id: str) -> Resume:
    resume = db.query(Resume).filter(Resume.id == resume_id, Resume.user_id == user.id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    return resume


def _own_analysis(db: Session, user: User, analysis_id: str) -> ResumeAnalysis:
    a = db.query(ResumeAnalysis).filter(ResumeAnalysis.id == analysis_id, ResumeAnalysis.user_id == user.id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return a


def _latest_analysis(db: Session, resume_id: str) -> ResumeAnalysis | None:
    return (db.query(ResumeAnalysis).filter(ResumeAnalysis.resume_id == resume_id)
            .order_by(ResumeAnalysis.created_at.desc()).first())


@router.post("/upload", response_model=ResumeOut, status_code=201)
def upload_resume(file: UploadFile = File(...), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    # Read one byte past the limit so oversized files are caught without loading them fully.
    content = file.file.read(settings.max_upload_bytes + 1)
    doc = parse_upload(file.filename, content)   # validates type, size, content; extracts clean text
    require_resume(doc.text)                     # rejects invoices, papers, random PDFs for free

    resume = Resume(user_id=user.id, filename=file.filename, raw_text=doc.text, text_hash=doc.text_hash,
                    word_count=doc.word_count, page_count=doc.pages, file_type=doc.file_type)
    db.add(resume)
    db.commit()
    db.refresh(resume)
    return resume


@router.get("/", response_model=List[ResumeOut])
def list_resumes(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(Resume).filter(Resume.user_id == user.id).order_by(Resume.created_at.desc()).all()


# Fixed paths must be declared before "/{resume_id}" so "analyses" isn't read as an id.
@router.get("/analyses", response_model=List[AnalysisOut])
def list_analyses(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(ResumeAnalysis).filter(ResumeAnalysis.user_id == user.id).order_by(ResumeAnalysis.created_at.desc()).all()


@router.get("/analyses/{analysis_id}", response_model=AnalysisOut)
def get_analysis(analysis_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _own_analysis(db, user, analysis_id)


@router.get("/analyses/{analysis_id}/report.pdf")
def analysis_report(analysis_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    a = _own_analysis(db, user, analysis_id)
    resume = db.query(Resume).filter(Resume.id == a.resume_id).first()
    rewrites = ((resume.rewrites or {}).get("rewrites") if resume else None) or None
    pdf = build_report_pdf(
        candidate=user.full_name,
        filename=resume.filename if resume else "resume",
        analysis={f: getattr(a, f) for f in (*_ANALYSIS_FIELDS, "created_at")},
        rewrites=rewrites,
        created=a.created_at or datetime.now(timezone.utc),
    )
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="careeriq-report-{a.id[:8]}.pdf"'})


@router.get("/{resume_id}", response_model=ResumeDetail)
def get_resume(resume_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _own_resume(db, user, resume_id)


@router.delete("/{resume_id}", status_code=204)
def delete_resume(resume_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    db.delete(_own_resume(db, user, resume_id))
    db.commit()


@router.get("/{resume_id}/scan")
def scan(resume_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """What a recruiter's six-second glance would pick up. Rule-based: free and instant."""
    resume = _own_resume(db, user, resume_id)
    latest = _latest_analysis(db, resume.id)
    ctx = {"experience": latest.experience, "education": latest.education} if latest else None
    return six_second_scan(resume.raw_text or "", ctx)


@router.post("/{resume_id}/analyze", response_model=AnalysisOut, status_code=201)
def analyze(
    resume_id: str,
    force: bool = Query(False, description="Ignore the cached result and run a fresh analysis"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    resume = _own_resume(db, user, resume_id)

    # Same text + same prompt version = same answer. Reuse it: free, instant, consistent.
    if not force and resume.text_hash:
        cached = (
            db.query(ResumeAnalysis)
            .join(Resume, ResumeAnalysis.resume_id == Resume.id)
            .filter(Resume.user_id == user.id, Resume.text_hash == resume.text_hash,
                    ResumeAnalysis.prompt_version == PROMPT_VERSION)
            .order_by(ResumeAnalysis.created_at.desc())
            .first()
        )
        if cached:
            if cached.resume_id == resume.id:
                return cached
            clone = ResumeAnalysis(user_id=user.id, resume_id=resume.id, **{f: getattr(cached, f) for f in _ANALYSIS_FIELDS})
            db.add(clone)
            db.commit()
            db.refresh(clone)
            return clone

    enforce_ai_quota(user.id)
    try:
        result = analyze_resume(resume.raw_text or "")
    except NotAResumeError:
        db.delete(resume)   # the AI says this isn't a resume: don't keep it
        db.commit()
        raise

    analysis = ResumeAnalysis(user_id=user.id, resume_id=resume.id, **{f: result.get(f) for f in _ANALYSIS_FIELDS})
    db.add(analysis)
    db.commit()
    db.refresh(analysis)
    return analysis


@router.get("/{resume_id}/analyses", response_model=List[AnalysisOut])
def resume_analyses(resume_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return (db.query(ResumeAnalysis)
            .filter(ResumeAnalysis.resume_id == resume_id, ResumeAnalysis.user_id == user.id)
            .order_by(ResumeAnalysis.created_at.desc()).all())


@router.post("/{resume_id}/rewrite")
def rewrite(
    resume_id: str,
    force: bool = Query(False),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Stronger versions of the weakest bullet points. Never invents numbers: unknown figures become [placeholders]."""
    resume = _own_resume(db, user, resume_id)
    if resume.rewrites and not force:
        return resume.rewrites
    enforce_ai_quota(user.id)
    result = rewrite_bullets(resume.raw_text or "")
    resume.rewrites = result
    db.commit()
    return result
