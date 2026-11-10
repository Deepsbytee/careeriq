from fastapi import APIRouter
from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.recruiter_tools import admin_router, screening_router
from app.api.v1.endpoints.resumes import router as resumes_router
from app.api.v1.endpoints.features import (
    job_router, recruiter_router, interview_router,
    portfolio_router, dashboard_router,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth_router)
api_router.include_router(resumes_router)
api_router.include_router(job_router)
api_router.include_router(recruiter_router)
api_router.include_router(interview_router)
api_router.include_router(portfolio_router)
api_router.include_router(dashboard_router)
api_router.include_router(screening_router)
api_router.include_router(admin_router)
