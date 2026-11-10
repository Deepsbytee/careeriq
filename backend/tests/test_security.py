import uuid

import pytest

from app.core import security
from app.core.config import settings

API = "/api/v1"
DEMO = {"candidate": "candidate@example.com", "recruiter": "recruiter@example.com", "admin": "admin@example.com"}


def login(client, email, password="DemoPass123!"):
    return client.post(f"{API}/auth/login", json={"email": email, "password": password})


def hdr(client, role):
    return {"Authorization": f"Bearer {login(client, DEMO[role]).json()['access_token']}"}


# ── hashing ──────────────────────────────────────────────────
def test_hash_roundtrip_and_format():
    h = security.get_password_hash("Correct horse battery")
    assert h.startswith("$2b$") and len(h) == 60
    assert security.verify_password("Correct horse battery", h)
    assert not security.verify_password("correct horse battery", h)


def test_each_hash_is_salted():
    assert security.get_password_hash("same") != security.get_password_hash("same")


def test_plaintext_never_verifies():
    assert not security.verify_password("secret123", "secret123")
    assert not security.verify_password("", "")
    assert not security.verify_password("x", None)


def test_unicode_and_length_limits():
    pw = "pässwörd-日本語-🔑"
    assert security.verify_password(pw, security.get_password_hash(pw))
    with pytest.raises(ValueError):
        security.get_password_hash("a" * 73)
    assert not security.verify_password("a" * 73, security.get_password_hash("a" * 72))


def test_malformed_hash_does_not_crash():
    assert not security.verify_password("x", "$2b$12$tooshort")


# ── migrating the old plaintext accounts ─────────────────────
def test_plaintext_passwords_are_upgraded_without_locking_anyone_out(client):
    from app.db.migrate import hash_plaintext_passwords
    from app.db.session import SessionLocal
    from app.models.models import User

    email, long_email = f"legacy-{uuid.uuid4().hex[:6]}@example.com", f"long-{uuid.uuid4().hex[:6]}@example.com"
    db = SessionLocal()
    try:
        db.add_all([User(email=email, full_name="Legacy", hashed_password="MyOldPassword1"),
                    User(email=long_email, full_name="Long", hashed_password="x" * 90)])
        db.commit()
        assert hash_plaintext_passwords(db) >= 2
        stored = db.query(User).filter(User.email == email).one().hashed_password
        assert stored.startswith("$2b$") and "MyOldPassword1" not in stored
        assert hash_plaintext_passwords(db) == 0                      # idempotent
    finally:
        db.close()
    assert login(client, email, "MyOldPassword1").status_code == 200       # same password still works
    assert login(client, long_email, "x" * 90).status_code == 401          # unusable: needs a reset


# ── register / login ─────────────────────────────────────────
def test_register_rules(client):
    short = client.post(f"{API}/auth/register", json={"email": "a@example.com", "full_name": "A", "password": "short"})
    assert short.status_code == 422 and short.json()["detail"] == "Password must be at least 8 characters."
    assert short.json()["code"] == "VALIDATION_ERROR"
    long = client.post(f"{API}/auth/register", json={"email": "a@example.com", "full_name": "A", "password": "x" * 80})
    assert long.status_code == 422 and "72" in long.json()["detail"]
    bad_email = client.post(f"{API}/auth/register", json={"email": "nope", "full_name": "A", "password": "Password1!"})
    assert bad_email.status_code == 422 and isinstance(bad_email.json()["detail"], str)


def test_emails_are_case_insensitive_and_unique(client):
    local = uuid.uuid4().hex[:8]
    ok = client.post(f"{API}/auth/register", json={"email": f"{local}@Example.com", "full_name": "Case", "password": "Password1!"})
    assert ok.status_code == 201
    dup = client.post(f"{API}/auth/register", json={"email": f"{local.upper()}@EXAMPLE.COM", "full_name": "Case", "password": "Password1!"})
    assert dup.status_code == 400
    assert login(client, f"{local}@example.COM", "Password1!").status_code == 200


def test_login_errors_do_not_reveal_which_part_was_wrong(client):
    wrong_pw = login(client, DEMO["candidate"], "nope-nope")
    unknown = login(client, "nobody@example.com", "nope-nope")
    assert wrong_pw.status_code == unknown.status_code == 401
    assert wrong_pw.json()["detail"] == unknown.json()["detail"]


def test_stored_passwords_are_hashed_for_new_users(client):
    from app.db.session import SessionLocal
    from app.models.models import User
    email = f"{uuid.uuid4().hex[:8]}@example.com"
    client.post(f"{API}/auth/register", json={"email": email, "full_name": "H", "password": "Password1!"})
    db = SessionLocal()
    try:
        assert db.query(User).filter(User.email == email).one().hashed_password.startswith("$2b$")
    finally:
        db.close()


# ── rate limiting ────────────────────────────────────────────
def test_login_is_rate_limited(client, monkeypatch):
    monkeypatch.setattr(settings, "AUTH_ATTEMPTS_PER_MINUTE", 3)
    codes = [login(client, "x@example.com", "wrong-pass").status_code for _ in range(5)]
    assert codes == [401, 401, 401, 429, 429]
    blocked = login(client, "x@example.com", "wrong-pass")
    assert blocked.json()["code"] == "TOO_MANY_ATTEMPTS" and int(blocked.headers["retry-after"]) >= 1


def test_daily_ai_limit_counts_real_calls_only(client, auth, ai_on, monkeypatch):
    from conftest import fake_ai_resume, make_pdf
    from samples import STRONG_RESUME

    from app.services import llm

    monkeypatch.setattr(settings, "AI_DAILY_LIMIT", 2)
    monkeypatch.setattr(llm, "generate_json", lambda s, u, schema=None, **k: schema.model_validate(fake_ai_resume()).model_dump())
    up = client.post(f"{API}/resumes/upload", files={"file": ("a.pdf", make_pdf(STRONG_RESUME), "application/pdf")}, headers=auth)
    rid = up.json()["id"]
    for _ in range(3):   # first call is real; repeats are served from the cache and cost nothing
        assert client.post(f"{API}/resumes/{rid}/analyze", headers=auth).status_code == 201
    assert client.post(f"{API}/resumes/{rid}/analyze?force=true", headers=auth).status_code == 201      # 2nd real call
    blocked = client.post(f"{API}/resumes/{rid}/analyze?force=true", headers=auth)                       # 3rd: over the limit
    assert blocked.status_code == 429 and blocked.json()["code"] == "DAILY_LIMIT_REACHED"


def test_ai_burst_limit(client, auth, ai_on, monkeypatch):
    from conftest import fake_ai_resume, make_pdf
    from samples import STRONG_RESUME

    from app.services import llm

    monkeypatch.setattr(settings, "AI_BURST_PER_MINUTE", 1)
    monkeypatch.setattr(llm, "generate_json", lambda s, u, schema=None, **k: schema.model_validate(fake_ai_resume()).model_dump())
    rid = client.post(f"{API}/resumes/upload", files={"file": ("a.pdf", make_pdf(STRONG_RESUME), "application/pdf")}, headers=auth).json()["id"]
    assert client.post(f"{API}/resumes/{rid}/analyze", headers=auth).status_code == 201
    assert client.post(f"{API}/resumes/{rid}/analyze?force=true", headers=auth).status_code == 429


# ── roles ────────────────────────────────────────────────────
def test_role_enforcement(client):
    cand, rec, adm = hdr(client, "candidate"), hdr(client, "recruiter"), hdr(client, "admin")
    assert client.get(f"{API}/admin/overview", headers=cand).status_code == 403
    assert client.get(f"{API}/admin/overview", headers=rec).status_code == 403
    ok = client.get(f"{API}/admin/overview", headers=adm)
    assert ok.status_code == 200 and set(ok.json()["users"]) == {"candidate", "recruiter", "admin"}
    forbidden = client.post(f"{API}/screening/rank", headers=cand, data={"job_title": "x", "job_description": "y"},
                            files=[("files", ("a.txt", b"hello", "text/plain"))])
    assert forbidden.status_code == 403 and forbidden.json()["code"] == "FORBIDDEN"
    assert client.get(f"{API}/admin/overview").status_code in (401, 403)         # no token


# ── startup safety and demo accounts ─────────────────────────
def test_production_refuses_a_weak_secret(monkeypatch):
    from app.main import check_runtime_safety
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    for weak in ("change-me-in-production", "short", ""):
        monkeypatch.setattr(settings, "SECRET_KEY", weak)
        with pytest.raises(RuntimeError, match="SECRET_KEY"):
            check_runtime_safety()
    monkeypatch.setattr(settings, "SECRET_KEY", "k" * 40)
    check_runtime_safety()


def test_development_only_warns(monkeypatch, caplog):
    from app.main import check_runtime_safety
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(settings, "SECRET_KEY", "change-me-in-production")
    check_runtime_safety()
    assert "SECRET_KEY" in caplog.text


def test_demo_mode_defaults(monkeypatch):
    monkeypatch.setattr(settings, "DEMO_MODE", None)
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    assert settings.demo_enabled is True
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    assert settings.demo_enabled is False
    monkeypatch.setattr(settings, "DEMO_MODE", True)
    assert settings.demo_enabled is True


def test_seeding_never_resets_an_existing_password(client):
    from app.db.session import SessionLocal
    from app.main import seed_demo_users
    from app.models.models import User

    db = SessionLocal()
    try:
        u = db.query(User).filter(User.email == DEMO["candidate"]).one()
        before = u.hashed_password
        assert seed_demo_users(db) == 0
        db.refresh(u)
        assert u.hashed_password == before
    finally:
        db.close()


# ── account deletion and export ──────────────────────────────
def test_delete_account_removes_everything(client, ai_on, monkeypatch):
    from conftest import fake_ai_resume, make_pdf
    from samples import STRONG_RESUME

    from app.db.session import SessionLocal
    from app.models.models import Resume, ResumeAnalysis, User
    from app.services import llm

    monkeypatch.setattr(llm, "generate_json", lambda s, u, schema=None, **k: schema.model_validate(fake_ai_resume()).model_dump())
    email = f"bye-{uuid.uuid4().hex[:6]}@example.com"
    token = client.post(f"{API}/auth/register", json={"email": email, "full_name": "Bye", "password": "Password1!"}).json()["access_token"]
    h = {"Authorization": f"Bearer {token}"}
    rid = client.post(f"{API}/resumes/upload", files={"file": ("a.pdf", make_pdf(STRONG_RESUME), "application/pdf")}, headers=h).json()["id"]
    client.post(f"{API}/resumes/{rid}/analyze", headers=h)

    export = client.get(f"{API}/auth/me/export", headers=h).json()
    assert export["account"]["email"] == email and len(export["resumes"]) == 1 and len(export["resume_analyses"]) == 1
    assert "hashed_password" not in str(export)

    assert client.request("DELETE", f"{API}/auth/me", json={"password": "wrong-password"}, headers=h).status_code == 403
    assert client.request("DELETE", f"{API}/auth/me", json={"password": "Password1!"}, headers=h).status_code == 204
    assert client.get(f"{API}/auth/me", headers=h).status_code == 401
    assert login(client, email, "Password1!").status_code == 401
    db = SessionLocal()
    try:
        assert db.query(User).filter(User.email == email).count() == 0
        assert db.query(Resume).filter(Resume.id == rid).count() == 0
        assert db.query(ResumeAnalysis).filter(ResumeAnalysis.resume_id == rid).count() == 0
    finally:
        db.close()


# ── profile and password changes ─────────────────────────────
def test_update_name(client, auth):
    r = client.patch(f"{API}/auth/me", json={"full_name": "  Priya   Sharma "}, headers=auth)
    assert r.status_code == 200 and r.json()["full_name"] == "Priya Sharma"
    assert client.get(f"{API}/auth/me", headers=auth).json()["full_name"] == "Priya Sharma"
    assert client.patch(f"{API}/auth/me", json={"full_name": "   "}, headers=auth).status_code == 422
    assert client.patch(f"{API}/auth/me", json={"full_name": "x" * 81}, headers=auth).status_code == 422


def test_change_password(client):
    email = f"pw-{uuid.uuid4().hex[:6]}@example.com"
    token = client.post(f"{API}/auth/register", json={"email": email, "full_name": "P", "password": "OldPassw0rd!"}).json()["access_token"]
    h = {"Authorization": f"Bearer {token}"}
    wrong = client.post(f"{API}/auth/change-password", json={"current_password": "nope-nope", "new_password": "NewPassw0rd!"}, headers=h)
    assert wrong.status_code == 403 and "current password" in wrong.json()["detail"]
    same = client.post(f"{API}/auth/change-password", json={"current_password": "OldPassw0rd!", "new_password": "OldPassw0rd!"}, headers=h)
    assert same.status_code == 400
    weak = client.post(f"{API}/auth/change-password", json={"current_password": "OldPassw0rd!", "new_password": "short"}, headers=h)
    assert weak.status_code == 422 and weak.json()["detail"] == "Password must be at least 8 characters."
    ok = client.post(f"{API}/auth/change-password", json={"current_password": "OldPassw0rd!", "new_password": "NewPassw0rd!"}, headers=h)
    assert ok.status_code == 204
    assert login(client, email, "OldPassw0rd!").status_code == 401
    assert login(client, email, "NewPassw0rd!").status_code == 200
