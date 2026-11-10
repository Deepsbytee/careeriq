from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, Any
from datetime import datetime
from app.models.models import UserRole


# ─── Auth ────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    email: EmailStr
    full_name: str
    password: str

    @field_validator("full_name")
    @classmethod
    def _name(cls, v: str) -> str:
        v = " ".join(v.split())
        if not 1 <= len(v) <= 80:
            raise ValueError("Enter your name (up to 80 characters).")
        return v

    @field_validator("password")
    @classmethod
    def _password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters.")
        if len(v.encode("utf-8")) > 72:
            raise ValueError("Password must be 72 bytes or fewer.")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class DeleteAccountRequest(BaseModel):
    password: str


class UpdateProfileRequest(BaseModel):
    full_name: str

    @field_validator("full_name")
    @classmethod
    def _name(cls, v: str) -> str:
        v = " ".join(v.split())
        if not 1 <= len(v) <= 80:
            raise ValueError("Enter your name (up to 80 characters).")
        return v


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def _password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters.")
        if len(v.encode("utf-8")) > 72:
            raise ValueError("Password must be 72 bytes or fewer.")
        return v


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ─── User ────────────────────────────────────────────────
class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: UserRole
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Resume ──────────────────────────────────────────────
class ResumeOut(BaseModel):
    id: str
    filename: str
    word_count: Optional[int] = None
    page_count: Optional[int] = None
    file_type: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ResumeDetail(ResumeOut):
    raw_text: Optional[str] = None
    rewrites: Optional[Any] = None


# ─── Analysis ────────────────────────────────────────────
class AnalysisOut(BaseModel):
    id: str
    resume_id: str
    ats_score: Optional[float]
    skills: Optional[Any]
    education: Optional[Any]
    experience: Optional[Any]
    keywords: Optional[Any]
    strengths: Optional[Any]
    weaknesses: Optional[Any]
    recommendations: Optional[Any]
    score_breakdown: Optional[Any] = None
    evidence: Optional[Any] = None
    summary: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Job Match ───────────────────────────────────────────
class JobMatchRequest(BaseModel):
    resume_id: str
    job_title: str
    job_description: str


class JobMatchOut(BaseModel):
    id: str
    resume_id: str
    job_title: Optional[str]
    match_score: Optional[float]
    skill_match_score: Optional[float]
    keyword_match_score: Optional[float]
    missing_skills: Optional[Any]
    missing_keywords: Optional[Any]
    missing_technologies: Optional[Any]
    recommendations: Optional[Any]
    requirements: Optional[Any] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Recruiter ───────────────────────────────────────────
class RecruiterRequest(BaseModel):
    resume_id: str


class RecruiterReportOut(BaseModel):
    id: str
    resume_id: str
    shortlist_probability: Optional[float]
    recruiter_notes: Optional[str]
    strengths: Optional[Any]
    weaknesses: Optional[Any]
    risk_factors: Optional[Any]
    hiring_recommendation: Optional[str]
    interview_questions: Optional[Any]
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Interview ───────────────────────────────────────────
class InterviewRequest(BaseModel):
    resume_id: Optional[str] = None
    job_role: str


class InterviewSessionOut(BaseModel):
    id: str
    job_role: Optional[str]
    technical_questions: Optional[Any]
    behavioral_questions: Optional[Any]
    project_questions: Optional[Any]
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Portfolio ───────────────────────────────────────────
class PortfolioRequest(BaseModel):
    github_username: str


class PortfolioOut(BaseModel):
    id: str
    github_username: Optional[str]
    repo_count: Optional[int]
    languages: Optional[Any]
    portfolio_score: Optional[float]
    internship_readiness: Optional[str]
    suggestions: Optional[Any]
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Dashboard ───────────────────────────────────────────
class DashboardStats(BaseModel):
    ats_score: Optional[float]
    match_score: Optional[float]
    portfolio_score: Optional[float]
    overall_score: Optional[float]
    overall_basis: list[str] = []
    resume_count: int
    analysis_count: int
    match_count: int
    recruiter_report_count: int
