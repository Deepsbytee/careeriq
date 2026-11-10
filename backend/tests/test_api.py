import pytest
from conftest import fake_ai_resume, make_docx, make_pdf, make_scanned_pdf
from samples import INVOICE, JOB_DESCRIPTION, RESEARCH_PAPER, STRONG_RESUME

from app.core.config import settings
from app.services import llm

API = "/api/v1"


def upload(client, auth, name, data, ctype="application/pdf"):
    return client.post(f"{API}/resumes/upload", files={"file": (name, data, ctype)}, headers=auth)


@pytest.fixture
def scripted_ai(monkeypatch, ai_on):
    calls = {"n": 0, "reply": fake_ai_resume()}

    def fake(system, user, schema=None, **kw):
        calls["n"] += 1
        return schema.model_validate(calls["reply"]).model_dump() if schema else calls["reply"]

    monkeypatch.setattr(llm, "generate_json", fake)
    return calls


# ── health ───────────────────────────────────────────────────
def test_health_reports_ai_status(client, monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
    h = client.get("/health").json()
    assert h["status"] == "ok" and h["ai"]["configured"] is False and h["ai"]["provider"] == "gemini"
    assert h["demo_mode"] is True                                  # development default
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "k")
    assert client.get("/health").json()["ai"]["configured"] is True


# ── upload validation: the "accepts any PDF" bug ─────────────
@pytest.mark.parametrize("name,data,status,code", [
    ("invoice.pdf", make_pdf(INVOICE), 422, "NOT_A_RESUME"),
    ("paper.pdf", make_pdf(RESEARCH_PAPER), 422, "NOT_A_RESUME"),
    ("scan.pdf", make_scanned_pdf(), 422, "NO_TEXT"),
    ("fake.pdf", b"this is not a pdf at all " * 50, 422, "CORRUPT_FILE"),
    ("photo.png", b"\x89PNG\r\n\x1a\n" + b"0" * 100, 415, "UNSUPPORTED_TYPE"),
    ("empty.pdf", b"", 422, "EMPTY_FILE"),
])
def test_bad_uploads_are_rejected_with_clear_messages(client, auth, name, data, status, code):
    r = upload(client, auth, name, data)
    assert r.status_code == status, r.text
    body = r.json()
    assert body["code"] == code and isinstance(body["detail"], str) and len(body["detail"]) > 20
    assert client.get(f"{API}/resumes/", headers=auth).json() == []        # nothing was saved


def test_invoice_message_names_the_document_type(client, auth):
    assert "invoice" in upload(client, auth, "bill.pdf", make_pdf(INVOICE)).json()["detail"]


def test_oversized_upload_is_413(client, auth, monkeypatch):
    monkeypatch.setattr(settings, "MAX_UPLOAD_MB", 1)
    r = upload(client, auth, "big.pdf", b"%PDF-1.4 " + b"x" * (1024 * 1024 + 5))
    assert r.status_code == 413 and r.json()["code"] == "FILE_TOO_LARGE"


def test_upload_requires_login(client):
    assert client.post(f"{API}/resumes/upload", files={"file": ("a.pdf", b"x", "application/pdf")}).status_code in (401, 403)


def test_valid_pdf_and_docx_and_txt_are_accepted(client, auth):
    r = upload(client, auth, "priya.pdf", make_pdf(STRONG_RESUME))
    assert r.status_code == 201
    body = r.json()
    assert body["file_type"] == "pdf" and body["page_count"] == 1 and body["word_count"] > 150

    docx = make_docx(STRONG_RESUME.split("\n"))
    assert upload(client, auth, "priya.docx", docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document").status_code == 201
    assert upload(client, auth, "priya.txt", STRONG_RESUME.encode(), "text/plain").status_code == 201


# ── analysis ─────────────────────────────────────────────────
def test_analysis_without_ai_key_is_a_clear_503_not_fake_data(client, auth, monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
    rid = upload(client, auth, "p.pdf", make_pdf(STRONG_RESUME)).json()["id"]
    r = client.post(f"{API}/resumes/{rid}/analyze", headers=auth)
    assert r.status_code == 503 and r.json()["code"] == "AI_NOT_CONFIGURED" and "GEMINI_API_KEY" in r.json()["detail"]
    assert client.get(f"{API}/resumes/analyses", headers=auth).json() == []


def test_full_analysis_flow(client, auth, scripted_ai):
    rid = upload(client, auth, "p.pdf", make_pdf(STRONG_RESUME)).json()["id"]
    r = client.post(f"{API}/resumes/{rid}/analyze", headers=auth)
    assert r.status_code == 201, r.text
    a = r.json()
    assert 0 <= a["ats_score"] <= 100 and a["summary"]
    assert set(a["score_breakdown"]["categories"]) == {"structure", "completeness", "impact", "keywords", "readability"}
    assert "Kubernetes" not in a["skills"] and "FastAPI" in a["skills"]
    assert "Won a Nobel prize" not in a["strengths"]
    assert a["evidence"]["strengths"][0]["verified"] is True
    assert a["recommendations"]


def test_repeat_analysis_uses_the_cache(client, auth, scripted_ai):
    rid = upload(client, auth, "p.pdf", make_pdf(STRONG_RESUME)).json()["id"]
    first = client.post(f"{API}/resumes/{rid}/analyze", headers=auth).json()
    second = client.post(f"{API}/resumes/{rid}/analyze", headers=auth).json()
    assert scripted_ai["n"] == 1 and first["id"] == second["id"]
    forced = client.post(f"{API}/resumes/{rid}/analyze?force=true", headers=auth).json()
    assert scripted_ai["n"] == 2 and forced["id"] != first["id"]


def test_reuploading_the_same_resume_reuses_the_analysis(client, auth, scripted_ai):
    pdf = make_pdf(STRONG_RESUME)
    r1, r2 = upload(client, auth, "a.pdf", pdf).json()["id"], upload(client, auth, "b.pdf", pdf).json()["id"]
    a1 = client.post(f"{API}/resumes/{r1}/analyze", headers=auth).json()
    a2 = client.post(f"{API}/resumes/{r2}/analyze", headers=auth).json()
    assert scripted_ai["n"] == 1 and a2["resume_id"] == r2 and a1["ats_score"] == a2["ats_score"]


def test_ai_says_not_a_resume_so_nothing_is_kept(client, auth, scripted_ai):
    rid = upload(client, auth, "p.pdf", make_pdf(STRONG_RESUME)).json()["id"]
    scripted_ai["reply"] = {"is_resume": False, "document_type": "cover letter", "not_resume_reason": "It's addressed to a hiring manager."}
    r = client.post(f"{API}/resumes/{rid}/analyze", headers=auth)
    assert r.status_code == 422 and r.json()["code"] == "NOT_A_RESUME"
    assert client.get(f"{API}/resumes/", headers=auth).json() == []


def test_ai_busy_is_reported_not_crashed(client, auth, ai_on, monkeypatch):
    from app.core.errors import AIBusyError

    def boom(*a, **k):
        raise AIBusyError("The AI is getting a lot of requests right now. Wait a minute and try again.")

    monkeypatch.setattr(llm, "generate_json", boom)
    rid = upload(client, auth, "p.pdf", make_pdf(STRONG_RESUME)).json()["id"]
    r = client.post(f"{API}/resumes/{rid}/analyze", headers=auth)
    assert r.status_code == 503 and r.json()["code"] == "AI_BUSY"
    assert len(client.get(f"{API}/resumes/", headers=auth).json()) == 1       # resume kept so you can retry


# ── ownership and deletion ───────────────────────────────────
def test_users_cannot_touch_each_others_resumes(client, auth, scripted_ai):
    import uuid
    other = client.post(f"{API}/auth/register", json={"email": f"o{uuid.uuid4().hex[:6]}@example.com", "full_name": "O", "password": "Passw0rd!x"})
    other_auth = {"Authorization": f"Bearer {other.json()['access_token']}"}
    rid = upload(client, auth, "p.pdf", make_pdf(STRONG_RESUME)).json()["id"]
    assert client.post(f"{API}/resumes/{rid}/analyze", headers=other_auth).status_code == 404
    assert client.delete(f"{API}/resumes/{rid}", headers=other_auth).status_code == 404
    assert client.post(f"{API}/interview/", json={"job_role": "Backend", "resume_id": rid}, headers=other_auth).status_code == 404


def test_delete_resume_removes_it_and_its_analyses(client, auth, scripted_ai):
    rid = upload(client, auth, "p.pdf", make_pdf(STRONG_RESUME)).json()["id"]
    client.post(f"{API}/resumes/{rid}/analyze", headers=auth)
    assert client.delete(f"{API}/resumes/{rid}", headers=auth).status_code == 204
    assert client.get(f"{API}/resumes/", headers=auth).json() == []
    assert client.get(f"{API}/resumes/analyses", headers=auth).json() == []


# ── other features ───────────────────────────────────────────
def test_job_match_validates_the_posting_and_uses_ai(client, auth, scripted_ai):
    rid = upload(client, auth, "p.pdf", make_pdf(STRONG_RESUME)).json()["id"]
    bad = client.post(f"{API}/job-match/", json={"resume_id": rid, "job_title": "X", "job_description": "python dev"}, headers=auth)
    assert bad.status_code == 422 and bad.json()["code"] == "JD_TOO_SHORT" and scripted_ai["n"] == 0
    scripted_ai["reply"] = {"match_score": 74, "skill_match_score": 66, "keyword_match_score": 60, "missing_skills": ["Kubernetes", "FastAPI"],
                            "missing_keywords": [], "missing_technologies": ["Terraform"], "recommendations": ["Learn Kubernetes."]}
    ok = client.post(f"{API}/job-match/", json={"resume_id": rid, "job_title": "Backend Engineer", "job_description": JOB_DESCRIPTION}, headers=auth)
    assert ok.status_code == 201, ok.text
    assert ok.json()["missing_skills"] == ["Kubernetes"]                      # FastAPI is on the resume


def test_recruiter_and_interview_flow(client, auth, scripted_ai):
    rid = upload(client, auth, "p.pdf", make_pdf(STRONG_RESUME)).json()["id"]
    scripted_ai["reply"] = {"shortlist_probability": 58, "recruiter_notes": "Solid for an intern.", "strengths": ["Quantified results"],
                            "weaknesses": ["No deployments"], "risk_factors": [], "hiring_recommendation": "Yes", "interview_questions": []}
    r = client.post(f"{API}/recruiter/", json={"resume_id": rid}, headers=auth)
    assert r.status_code == 201 and r.json()["hiring_recommendation"] == "Yes"
    qa = {"question": "Explain JWT.", "expected_answer": "Signed tokens.", "evaluation_criteria": "Security"}
    scripted_ai["reply"] = {"technical_questions": [qa], "behavioral_questions": [qa], "project_questions": [qa]}
    i = client.post(f"{API}/interview/", json={"job_role": "Backend Engineer", "resume_id": rid}, headers=auth)
    assert i.status_code == 201 and i.json()["technical_questions"][0]["question"] == "Explain JWT."


def test_portfolio_errors_are_real_not_fabricated(client, auth, monkeypatch):
    import httpx
    from app.services import ai_service

    def fake_get(url, **kw):
        return httpx.Response(404, json={"message": "Not Found"}, request=httpx.Request("GET", url))

    monkeypatch.setattr(ai_service.httpx, "get", fake_get)
    r = client.post(f"{API}/portfolio/", json={"github_username": "no-such-user-xyz"}, headers=auth)
    assert r.status_code == 404 and r.json()["code"] == "GITHUB_USER_NOT_FOUND"
    assert client.get(f"{API}/portfolio/", headers=auth).json() == []

    monkeypatch.setattr(ai_service.httpx, "get", lambda url, **kw: httpx.Response(403, request=httpx.Request("GET", url)))
    assert client.post(f"{API}/portfolio/", json={"github_username": "octocat"}, headers=auth).json()["code"] == "GITHUB_RATE_LIMITED"

    def boom(url, **kw):
        raise httpx.ConnectError("offline")

    monkeypatch.setattr(ai_service.httpx, "get", boom)
    assert client.post(f"{API}/portfolio/", json={"github_username": "octocat"}, headers=auth).status_code == 502


def test_portfolio_scores_real_repo_data(client, auth, monkeypatch):
    import httpx
    from datetime import datetime, timedelta, timezone
    from app.services import ai_service

    recent = (datetime.now(timezone.utc) - timedelta(days=10)).isoformat().replace("+00:00", "Z")
    old = (datetime.now(timezone.utc) - timedelta(days=900)).isoformat().replace("+00:00", "Z")
    repos = [
        {"name": "a", "language": "Python", "description": "API", "stargazers_count": 3, "fork": False, "pushed_at": recent},
        {"name": "b", "language": "TypeScript", "description": "UI", "stargazers_count": 0, "fork": False, "pushed_at": recent},
        {"name": "c", "language": "Python", "description": "", "stargazers_count": 0, "fork": False, "pushed_at": old},
        {"name": "forked", "language": "Go", "description": "x", "stargazers_count": 999, "fork": True, "pushed_at": recent},
    ]
    monkeypatch.setattr(ai_service.httpx, "get", lambda url, **kw: httpx.Response(200, json=repos, request=httpx.Request("GET", url)))
    r = client.post(f"{API}/portfolio/", json={"github_username": "https://github.com/priya"}, headers=auth)
    assert r.status_code == 201, r.text
    p = r.json()
    assert p["repo_count"] == 3 and p["github_username"] == "priya"                 # the fork is ignored
    assert p["languages"] == {"Python": 2, "TypeScript": 1} and 20 < p["portfolio_score"] < 60
    assert any("no description" in s for s in p["suggestions"])
