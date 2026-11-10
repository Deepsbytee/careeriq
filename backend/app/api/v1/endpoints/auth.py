from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.ratelimit import auth_rate_limit
from app.core.security import create_access_token, get_password_hash, verify_password
from app.db.session import get_db
from app.models.models import JobMatch, PortfolioAnalysis, RecruiterReport, Resume, ResumeAnalysis, User
from app.schemas.schemas import (
    ChangePasswordRequest, DeleteAccountRequest, LoginRequest, RegisterRequest, TokenResponse,
    UpdateProfileRequest, UserOut,
)

router = APIRouter(prefix="/auth", tags=["auth"])

# Hashing is slow on purpose; verifying against this keeps "unknown email" and
# "wrong password" equally slow, so response time doesn't reveal which emails exist.
_DUMMY_HASH = get_password_hash("not-a-real-password")


def _find_user(db: Session, email: str) -> User | None:
    return db.query(User).filter(func.lower(User.email) == email.strip().lower()).first()


@router.post("/register", response_model=TokenResponse, status_code=201, dependencies=[Depends(auth_rate_limit)])
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    if _find_user(db, payload.email):
        raise HTTPException(status_code=400, detail="That email is already registered. Try logging in.")
    user = User(
        email=payload.email.strip().lower(),
        full_name=payload.full_name,
        hashed_password=get_password_hash(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"access_token": create_access_token({"sub": user.id})}


@router.post("/login", response_model=TokenResponse, dependencies=[Depends(auth_rate_limit)])
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = _find_user(db, payload.email)
    ok = verify_password(payload.password, user.hashed_password if user else _DUMMY_HASH)
    if not user or not ok or not user.is_active:
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    return {"access_token": create_access_token({"sub": user.id})}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.patch("/me", response_model=UserOut)
def update_profile(payload: UpdateProfileRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    user.full_name = payload.full_name
    db.commit()
    db.refresh(user)
    return user


@router.post("/change-password", status_code=204, dependencies=[Depends(auth_rate_limit)])
def change_password(payload: ChangePasswordRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(status_code=403, detail="Your current password is incorrect.")
    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=400, detail="Choose a new password that's different from the current one.")
    user.hashed_password = get_password_hash(payload.new_password)
    db.commit()


@router.get("/me/export")
def export_my_data(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Everything CareerIQ stores about you, as JSON."""

    def rows(model):
        return [
            {c.name: (v.isoformat() if hasattr(v, "isoformat") else v) for c in model.__table__.columns for v in [getattr(r, c.name)]}
            for r in db.query(model).filter(model.user_id == user.id).all()
        ]

    return {
        "account": {"email": user.email, "full_name": user.full_name, "role": user.role.value, "created_at": user.created_at.isoformat()},
        "resumes": rows(Resume),
        "resume_analyses": rows(ResumeAnalysis),
        "job_matches": rows(JobMatch),
        "recruiter_reports": rows(RecruiterReport),
        "portfolio_analyses": rows(PortfolioAnalysis),
    }


@router.delete("/me", status_code=204, dependencies=[Depends(auth_rate_limit)])
def delete_my_account(payload: DeleteAccountRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Permanently deletes the account and everything attached to it."""
    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=403, detail="That password is incorrect.")
    db.delete(user)  # related rows are removed by the ORM cascades
    db.commit()
