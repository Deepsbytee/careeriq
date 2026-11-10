import enum
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, Text, ForeignKey, Enum, JSON
from sqlalchemy.orm import relationship
from app.db.session import Base
import uuid


def gen_uuid():
    return str(uuid.uuid4())


class UserRole(str, enum.Enum):
    candidate = "candidate"
    recruiter = "recruiter"
    admin = "admin"


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_uuid)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.candidate)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    resumes = relationship("Resume", back_populates="user", cascade="all, delete-orphan")
    analyses = relationship("ResumeAnalysis", back_populates="user", cascade="all, delete-orphan")
    job_matches = relationship("JobMatch", back_populates="user", cascade="all, delete-orphan")
    recruiter_reports = relationship("RecruiterReport", back_populates="user", cascade="all, delete-orphan")
    interview_sessions = relationship("InterviewSession", back_populates="user", cascade="all, delete-orphan")
    portfolio_analyses = relationship("PortfolioAnalysis", back_populates="user", cascade="all, delete-orphan")


class Resume(Base):
    __tablename__ = "resumes"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    filename = Column(String, nullable=False)
    raw_text = Column(Text)
    text_hash = Column(String, index=True)
    word_count = Column(Integer)
    page_count = Column(Integer)
    file_type = Column(String)
    rewrites = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="resumes")
    analyses = relationship("ResumeAnalysis", back_populates="resume", cascade="all, delete-orphan")
    job_matches = relationship("JobMatch", back_populates="resume", cascade="all, delete-orphan")
    recruiter_reports = relationship("RecruiterReport", back_populates="resume", cascade="all, delete-orphan")
    interview_sessions = relationship("InterviewSession", back_populates="resume", cascade="all, delete-orphan")


class ResumeAnalysis(Base):
    __tablename__ = "resume_analyses"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    resume_id = Column(String, ForeignKey("resumes.id"), nullable=False)
    ats_score = Column(Float)
    skills = Column(JSON)
    education = Column(JSON)
    experience = Column(JSON)
    keywords = Column(JSON)
    strengths = Column(JSON)
    weaknesses = Column(JSON)
    recommendations = Column(JSON)
    score_breakdown = Column(JSON)
    evidence = Column(JSON)
    summary = Column(Text)
    prompt_version = Column(String)
    raw_result = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="analyses")
    resume = relationship("Resume", back_populates="analyses")


class JobMatch(Base):
    __tablename__ = "job_matches"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    resume_id = Column(String, ForeignKey("resumes.id"), nullable=False)
    job_title = Column(String)
    job_description = Column(Text)
    match_score = Column(Float)
    skill_match_score = Column(Float)
    keyword_match_score = Column(Float)
    missing_skills = Column(JSON)
    missing_keywords = Column(JSON)
    missing_technologies = Column(JSON)
    recommendations = Column(JSON)
    requirements = Column(JSON)
    raw_result = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="job_matches")
    resume = relationship("Resume", back_populates="job_matches")


class RecruiterReport(Base):
    __tablename__ = "recruiter_reports"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    resume_id = Column(String, ForeignKey("resumes.id"), nullable=False)
    shortlist_probability = Column(Float)
    recruiter_notes = Column(Text)
    strengths = Column(JSON)
    weaknesses = Column(JSON)
    risk_factors = Column(JSON)
    hiring_recommendation = Column(String)
    interview_questions = Column(JSON)
    raw_result = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="recruiter_reports")
    resume = relationship("Resume", back_populates="recruiter_reports")


class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    resume_id = Column(String, ForeignKey("resumes.id"), nullable=True)
    job_role = Column(String)
    technical_questions = Column(JSON)
    behavioral_questions = Column(JSON)
    project_questions = Column(JSON)
    raw_result = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="interview_sessions")
    resume = relationship("Resume", back_populates="interview_sessions")


class PortfolioAnalysis(Base):
    __tablename__ = "portfolio_analyses"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    github_username = Column(String)
    repo_count = Column(Integer)
    languages = Column(JSON)
    portfolio_score = Column(Float)
    internship_readiness = Column(String)
    suggestions = Column(JSON)
    raw_result = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="portfolio_analyses")
