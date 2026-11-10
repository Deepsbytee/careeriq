from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.core.deps import get_current_user
from app.core.ratelimit import enforce_ai_quota
from app.services.document_parser import validate_job_description
from app.models.models import User, Resume, JobMatch, RecruiterReport, InterviewSession, PortfolioAnalysis, ResumeAnalysis
from app.schemas.schemas import (
    JobMatchRequest, JobMatchOut,
    RecruiterRequest, RecruiterReportOut,
    InterviewRequest, InterviewSessionOut,
    PortfolioRequest, PortfolioOut,
    DashboardStats,
)
from app.services.ai_service import match_job, simulate_recruiter, generate_interview_prep, analyze_portfolio

# ─── Job Match ───────────────────────────────────────────
job_router = APIRouter(prefix="/job-match", tags=["job-match"])


@job_router.post("/", response_model=JobMatchOut, status_code=201)
def create_job_match(payload: JobMatchRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    resume = db.query(Resume).filter(Resume.id == payload.resume_id, Resume.user_id == user.id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    validate_job_description(payload.job_description)   # reject bad input before it counts against the AI quota
    enforce_ai_quota(user.id)
    result = match_job(resume.raw_text or "", payload.job_description)
    jm = JobMatch(
        user_id=user.id,
        resume_id=resume.id,
        job_title=payload.job_title,
        job_description=payload.job_description,
        match_score=result.get("match_score"),
        skill_match_score=result.get("skill_match_score"),
        keyword_match_score=result.get("keyword_match_score"),
        missing_skills=result.get("missing_skills"),
        missing_keywords=result.get("missing_keywords"),
        missing_technologies=result.get("missing_technologies"),
        recommendations=result.get("recommendations"),
        requirements=result.get("requirements"),
        raw_result=result.get("raw_result"),
    )
    db.add(jm)
    db.commit()
    db.refresh(jm)
    return jm


@job_router.get("/", response_model=List[JobMatchOut])
def list_matches(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(JobMatch).filter(JobMatch.user_id == user.id).order_by(JobMatch.created_at.desc()).all()


# ─── Recruiter ───────────────────────────────────────────
recruiter_router = APIRouter(prefix="/recruiter", tags=["recruiter"])


@recruiter_router.post("/", response_model=RecruiterReportOut, status_code=201)
def create_report(payload: RecruiterRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    resume = db.query(Resume).filter(Resume.id == payload.resume_id, Resume.user_id == user.id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    enforce_ai_quota(user.id)
    result = simulate_recruiter(resume.raw_text or "")
    report = RecruiterReport(
        user_id=user.id,
        resume_id=resume.id,
        shortlist_probability=result.get("shortlist_probability"),
        recruiter_notes=result.get("recruiter_notes"),
        strengths=result.get("strengths"),
        weaknesses=result.get("weaknesses"),
        risk_factors=result.get("risk_factors"),
        hiring_recommendation=result.get("hiring_recommendation"),
        interview_questions=result.get("interview_questions"),
        raw_result=result.get("raw_result"),
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


@recruiter_router.get("/", response_model=List[RecruiterReportOut])
def list_reports(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(RecruiterReport).filter(RecruiterReport.user_id == user.id).order_by(RecruiterReport.created_at.desc()).all()


# ─── Interview ───────────────────────────────────────────
interview_router = APIRouter(prefix="/interview", tags=["interview"])


@interview_router.post("/", response_model=InterviewSessionOut, status_code=201)
def create_session(payload: InterviewRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    resume_text = None
    resume_id = None
    if payload.resume_id:
        resume = db.query(Resume).filter(Resume.id == payload.resume_id, Resume.user_id == user.id).first()
        if not resume:
            raise HTTPException(status_code=404, detail="Resume not found")
        resume_text, resume_id = resume.raw_text, resume.id
    enforce_ai_quota(user.id)
    result = generate_interview_prep(payload.job_role, resume_text)
    session = InterviewSession(
        user_id=user.id,
        resume_id=resume_id,
        job_role=payload.job_role,
        technical_questions=result.get("technical_questions"),
        behavioral_questions=result.get("behavioral_questions"),
        project_questions=result.get("project_questions"),
        raw_result=result.get("raw_result"),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@interview_router.get("/", response_model=List[InterviewSessionOut])
def list_sessions(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(InterviewSession).filter(InterviewSession.user_id == user.id).order_by(InterviewSession.created_at.desc()).all()


# ─── Portfolio ───────────────────────────────────────────
portfolio_router = APIRouter(prefix="/portfolio", tags=["portfolio"])


@portfolio_router.post("/", response_model=PortfolioOut, status_code=201)
def create_portfolio(payload: PortfolioRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    github_username = payload.github_username.strip()
    result = analyze_portfolio(github_username)
    pa = PortfolioAnalysis(
        user_id=user.id,
        github_username=(result.get("raw_result") or {}).get("username", github_username.lstrip("@").strip()),
        repo_count=result.get("repo_count"),
        languages=result.get("languages"),
        portfolio_score=result.get("portfolio_score"),
        internship_readiness=result.get("internship_readiness"),
        suggestions=result.get("suggestions"),
        raw_result=result.get("raw_result"),
    )
    db.add(pa)
    db.commit()
    db.refresh(pa)
    return pa


@portfolio_router.get("/", response_model=List[PortfolioOut])
def list_portfolios(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(PortfolioAnalysis).filter(PortfolioAnalysis.user_id == user.id).order_by(PortfolioAnalysis.created_at.desc()).all()


# ─── Dashboard ───────────────────────────────────────────
dashboard_router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@dashboard_router.get("/stats", response_model=DashboardStats)
def get_stats(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    latest_analysis = (
        db.query(ResumeAnalysis)
        .filter(ResumeAnalysis.user_id == user.id)
        .order_by(ResumeAnalysis.created_at.desc())
        .first()
    )
    latest_match = (
        db.query(JobMatch)
        .filter(JobMatch.user_id == user.id)
        .order_by(JobMatch.created_at.desc())
        .first()
    )
    latest_portfolio = (
        db.query(PortfolioAnalysis)
        .filter(PortfolioAnalysis.user_id == user.id)
        .order_by(PortfolioAnalysis.created_at.desc())
        .first()
    )

    ats = latest_analysis.ats_score if latest_analysis else None
    match = latest_match.match_score if latest_match else None
    port = latest_portfolio.portfolio_score if latest_portfolio else None

    # Overall score: a plain average of whichever of the three latest scores exist.
    parts = [("Resume ATS score", ats), ("Job match", match), ("Portfolio", port)]
    present = [(name, v) for name, v in parts if v is not None]
    overall = round(sum(v for _, v in present) / len(present), 1) if present else None

    return DashboardStats(
        ats_score=ats,
        match_score=match,
        portfolio_score=port,
        overall_score=overall,
        overall_basis=[name for name, _ in present],
        resume_count=db.query(Resume).filter(Resume.user_id == user.id).count(),
        analysis_count=db.query(ResumeAnalysis).filter(ResumeAnalysis.user_id == user.id).count(),
        match_count=db.query(JobMatch).filter(JobMatch.user_id == user.id).count(),
        recruiter_report_count=db.query(RecruiterReport).filter(RecruiterReport.user_id == user.id).count(),
    )


@dashboard_router.get("/activity")
def get_activity(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    analyses = db.query(ResumeAnalysis).filter(ResumeAnalysis.user_id == user.id).order_by(ResumeAnalysis.created_at.desc()).limit(5).all()
    matches = db.query(JobMatch).filter(JobMatch.user_id == user.id).order_by(JobMatch.created_at.desc()).limit(5).all()
    reports = db.query(RecruiterReport).filter(RecruiterReport.user_id == user.id).order_by(RecruiterReport.created_at.desc()).limit(5).all()

    activity = []
    for a in analyses:
        activity.append({"type": "analysis", "id": a.id, "label": f"Resume analyzed — ATS {a.ats_score}", "created_at": a.created_at.isoformat()})
    for m in matches:
        activity.append({"type": "match", "id": m.id, "label": f"Job match: {m.job_title} — {m.match_score}%", "created_at": m.created_at.isoformat()})
    for r in reports:
        activity.append({"type": "report", "id": r.id, "label": f"Recruiter review — {r.hiring_recommendation}", "created_at": r.created_at.isoformat()})

    activity.sort(key=lambda x: x["created_at"], reverse=True)
    return activity[:10]


@dashboard_router.get("/analytics")
def get_analytics(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    analyses = db.query(ResumeAnalysis).filter(ResumeAnalysis.user_id == user.id).order_by(ResumeAnalysis.created_at.asc()).all()
    matches = db.query(JobMatch).filter(JobMatch.user_id == user.id).order_by(JobMatch.created_at.asc()).all()
    portfolios = db.query(PortfolioAnalysis).filter(PortfolioAnalysis.user_id == user.id).order_by(PortfolioAnalysis.created_at.asc()).all()

    return {
        "ats_trend": [{"date": a.created_at.isoformat(), "score": a.ats_score} for a in analyses],
        "match_trend": [{"date": m.created_at.isoformat(), "score": m.match_score} for m in matches],
        "portfolio_trend": [{"date": p.created_at.isoformat(), "score": p.portfolio_score} for p in portfolios],
    }
