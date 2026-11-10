import io
import uuid

import pytest
from conftest import fake_ai_resume, make_pdf
from samples import (
    INVOICE, JOB_DESCRIPTION, MEDIUM_RESUME, STRONG_RESUME, WEAK_BULLETS_RESUME,
)

from app.core.config import settings
from app.services import llm
from app.services.document_parser import normalise_text
from app.services.resume_insights import guess_name, invented_numbers, pick_weak_bullets, six_second_scan

API = "/api/v1"


def up(client, auth, text, name="r.pdf"):
    r = client.post(f"{API}/resumes/upload", files={"file": (name, make_pdf(text), "application/pdf")}, headers=auth)
    assert r.status_code == 201, r.text
    return r.json()["id"]


@pytest.fixture
def scripted(ai_on, monkeypatch):
    state = {"n": 0, "reply": fake_ai_resume()}

    def fake(system, user, schema=None, **kw):
        state["n"] += 1
        reply = state["reply"]
        return schema.model_validate(reply).model_dump() if schema else reply

    monkeypatch.setattr(llm, "generate_json", fake)
    return state


# ── insights (pure functions) ────────────────────────────────
def test_guess_name():
    assert guess_name("Priya Sharma\nemail@x.com") == "Priya Sharma"
    assert guess_name("PRIYA SHARMA\nx") == "Priya Sharma"
    assert guess_name("priya@x.com\nPriya Sharma") is None
    assert guess_name("Curriculum Vitae of a very long heading line here") is None
    assert guess_name("") is None


def test_invented_numbers_allows_placeholders_and_original_figures():
    orig = "Built REST API handling 200 requests per minute"
    assert invented_numbers(orig, "Built a REST API serving 200 requests per minute, cutting latency by [X%]") == []
    assert invented_numbers(orig, "Built a REST API handling 200 requests, improving speed by 40%") == ["40"]
    assert invented_numbers("Handled 1,200 orders", "Processed 1200 orders") == []
    assert invented_numbers("Led a team", "Led a team of 5") == ["5"]


def test_weak_bullets_are_ranked_and_good_ones_left_alone():
    weak = pick_weak_bullets(normalise_text(WEAK_BULLETS_RESUME))
    assert 1 <= len(weak) <= 5
    assert "Responsible for working on the backend of the company website." in weak
    assert not any("200 requests per minute" in b for b in weak)           # a strong bullet isn't touched
    assert pick_weak_bullets(normalise_text(STRONG_RESUME), limit=20) != []  # even strong resumes have a few weak ones
    assert not any("cutting average response time by 35%" in b for b in pick_weak_bullets(normalise_text(STRONG_RESUME), limit=20))


def test_scan_reports_what_a_recruiter_sees():
    s = six_second_scan(normalise_text(STRONG_RESUME))
    assert s["name"] == "Priya Sharma" and s["signals"] == {"email": True, "phone": True, "linkedin": True, "github": True}
    assert len(s["top_skills"]) == 6 and all(n["kind"] in ("good", "warn") for n in s["notes"])
    assert any("name" in n["text"].lower() and n["kind"] == "good" for n in s["notes"])
    w = six_second_scan(normalise_text(WEAK_BULLETS_RESUME))
    assert any(n["kind"] == "warn" and "LinkedIn" in n["text"] for n in w["notes"])
    assert any(n["kind"] == "warn" and "number" in n["text"] for n in w["notes"])


# ── scan endpoint ────────────────────────────────────────────
def test_scan_endpoint_uses_the_analysis_when_available(client, auth, scripted):
    rid = up(client, auth, STRONG_RESUME)
    before = client.get(f"{API}/resumes/{rid}/scan", headers=auth).json()
    assert before["latest_role"] is None and before["name"] == "Priya Sharma"
    assert scripted["n"] == 0                                              # no AI used
    client.post(f"{API}/resumes/{rid}/analyze", headers=auth)
    after = client.get(f"{API}/resumes/{rid}/scan", headers=auth).json()
    assert after["latest_role"] == "Software Development Intern at Oasis Infobyte"
    assert after["education"].startswith("B.E. Computer Science")


def test_get_resume_returns_text_for_highlighting(client, auth):
    rid = up(client, auth, STRONG_RESUME)
    r = client.get(f"{API}/resumes/{rid}", headers=auth).json()
    assert "cutting average response time by 35%" in r["raw_text"].replace("\n", " ")
    assert r["rewrites"] is None
    other = client.post(f"{API}/auth/register", json={"email": f"{uuid.uuid4().hex[:8]}@example.com", "full_name": "O", "password": "Password1!"})
    assert client.get(f"{API}/resumes/{rid}", headers={"Authorization": f"Bearer {other.json()['access_token']}"}).status_code == 404


# ── bullet rewriter ──────────────────────────────────────────
def test_rewriter_blocks_invented_numbers_and_keeps_placeholders(client, auth, scripted):
    rid = up(client, auth, WEAK_BULLETS_RESUME)
    text = client.get(f"{API}/resumes/{rid}", headers=auth).json()["raw_text"]
    bullets = pick_weak_bullets(text)
    scripted["reply"] = {"rewrites": [
        {"id": 0, "rewritten": "Developed backend features for the company website, improving page load by [X%].", "why": "Active verb and a place for a result."},
        {"id": 1, "rewritten": "Tested and shipped 12 features, reducing bugs by 40%.", "why": "x"},              # invented figures
        {"id": 2, "rewritten": bullets[2], "why": "unchanged"},                                                   # identical to original
        {"id": 99, "rewritten": "Out of range id.", "why": "x"},
    ]}
    r = client.post(f"{API}/resumes/{rid}/rewrite", headers=auth)
    assert r.status_code == 200
    body = r.json()
    assert body["considered"] == len(bullets) and body["skipped"] == 2
    assert len(body["rewrites"]) == 1
    assert body["rewrites"][0]["original"] == bullets[0] and "[X%]" in body["rewrites"][0]["rewritten"]


def test_rewrites_are_cached_until_forced(client, auth, scripted):
    rid = up(client, auth, WEAK_BULLETS_RESUME)
    scripted["reply"] = {"rewrites": []}
    client.post(f"{API}/resumes/{rid}/rewrite", headers=auth)
    client.post(f"{API}/resumes/{rid}/rewrite", headers=auth)
    assert scripted["n"] == 1
    client.post(f"{API}/resumes/{rid}/rewrite?force=true", headers=auth)
    assert scripted["n"] == 2


def test_rewriter_skips_the_ai_when_there_is_nothing_weak(client, auth, scripted):
    from app.services import ai_service
    text = normalise_text("Jo Doe\njo@example.com\nEXPERIENCE\n• Built 5 APIs that cut latency by 40% for 2000 users.\n")
    assert ai_service.rewrite_bullets(text)["rewrites"] == [] and scripted["n"] == 0


# ── PDF report ───────────────────────────────────────────────
def test_pdf_report_contains_the_analysis(client, auth, scripted):
    from pypdf import PdfReader
    rid = up(client, auth, STRONG_RESUME)
    aid = client.post(f"{API}/resumes/{rid}/analyze", headers=auth).json()["id"]
    r = client.get(f"{API}/resumes/analyses/{aid}/report.pdf", headers=auth)
    assert r.status_code == 200 and r.headers["content-type"] == "application/pdf"
    assert r.content.startswith(b"%PDF-") and "attachment" in r.headers["content-disposition"]
    text = "\n".join(p.extract_text() for p in PdfReader(io.BytesIO(r.content)).pages)
    assert "CareerIQ resume report" in text and "Priya Sharma" not in text.split("Generated")[0][:0]   # header present
    assert "Score breakdown" in text and "Structure" in text and "Impact" in text
    assert "Quantified internship results" in text and "cutting average response time by 35%" in text
    assert "Nobel" not in text                                                                           # fabricated claim stayed out
    assert "Add live demo links" in text and "Measured checks" in text


def test_pdf_report_includes_rewrites_and_survives_odd_characters(client, auth, scripted):
    from pypdf import PdfReader
    rid = up(client, auth, STRONG_RESUME)
    scripted["reply"] = fake_ai_resume(summary="Strong profile 🚀 with “smart quotes” & <tags> — and 日本語",
                                       recommendations=["Fix <b>this</b> & that → now"])
    aid = client.post(f"{API}/resumes/{rid}/analyze", headers=auth).json()["id"]
    scripted["reply"] = {"rewrites": [{"id": 0, "rewritten": "Developed a thing, improving speed by [X%].", "why": "x"}]}
    client.post(f"{API}/resumes/{rid}/rewrite?force=true", headers=auth)
    r = client.get(f"{API}/resumes/analyses/{aid}/report.pdf", headers=auth)
    assert r.status_code == 200
    text = "\n".join(p.extract_text() for p in PdfReader(io.BytesIO(r.content)).pages)
    assert "smart quotes" in text and "<b>this</b>" in text                       # markup was escaped, not interpreted


def test_report_is_private(client, auth, scripted):
    rid = up(client, auth, STRONG_RESUME)
    aid = client.post(f"{API}/resumes/{rid}/analyze", headers=auth).json()["id"]
    other = client.post(f"{API}/auth/register", json={"email": f"{uuid.uuid4().hex[:8]}@example.com", "full_name": "O", "password": "Password1!"})
    h = {"Authorization": f"Bearer {other.json()['access_token']}"}
    assert client.get(f"{API}/resumes/analyses/{aid}/report.pdf", headers=h).status_code == 404
    assert client.get(f"{API}/resumes/analyses/{aid}", headers=h).status_code == 404
    assert client.get(f"{API}/resumes/analyses/{aid}", headers=auth).json()["id"] == aid


# ── job match requirements ───────────────────────────────────
def test_requirements_are_verified_and_drive_the_score(client, auth, scripted):
    rid = up(client, auth, STRONG_RESUME)
    scripted["reply"] = {
        "requirements": [
            {"requirement": "Python and FastAPI", "importance": "must", "status": "met",
             "evidence": "Built 6 REST API endpoints with FastAPI and PostgreSQL", "note": "Direct experience."},
            {"requirement": "Kubernetes on AWS", "importance": "must", "status": "met",
             "evidence": "Deployed a 40 node Kubernetes cluster on AWS", "note": "Made up."},            # fabricated proof
            {"requirement": "Redis caching", "importance": "nice", "status": "missing", "evidence": "", "note": "Not mentioned."},
            {"requirement": "Docker", "importance": "preferred", "status": "Partially", "evidence": "Containerized the app with Docker", "note": "x"},
        ],
        "match_score": 80, "skill_match_score": 70, "keyword_match_score": 60,
        "missing_skills": [], "missing_keywords": [], "missing_technologies": [], "recommendations": ["Learn Kubernetes."],
    }
    r = client.post(f"{API}/job-match/", json={"resume_id": rid, "job_title": "Backend Engineer", "job_description": JOB_DESCRIPTION}, headers=auth)
    assert r.status_code == 201, r.text
    body = r.json()
    reqs = {q["requirement"]: q for q in body["requirements"]}
    assert reqs["Python and FastAPI"]["status"] == "met" and reqs["Python and FastAPI"]["verified"] is True
    assert reqs["Kubernetes on AWS"]["status"] == "unverified" and reqs["Kubernetes on AWS"]["evidence"] is None
    assert reqs["Redis caching"]["status"] == "missing" and reqs["Redis caching"]["importance"] == "nice"
    assert reqs["Docker"]["status"] == "partial" and reqs["Docker"]["importance"] == "nice"
    # weights: must=2, nice=1.  met(1.0)*2 + unverified(.25)*2 + missing(0)*1 + partial(.5)*1 = 3.0 of 6  -> 50
    # final = 0.5 * AI 80 + 0.5 * 50 = 65
    assert body["match_score"] == 65.0


def test_without_requirements_the_ai_score_stands(client, auth, scripted):
    rid = up(client, auth, STRONG_RESUME)
    scripted["reply"] = {"match_score": 72, "skill_match_score": 60, "keyword_match_score": 50, "recommendations": []}
    body = client.post(f"{API}/job-match/", json={"resume_id": rid, "job_title": "B", "job_description": JOB_DESCRIPTION}, headers=auth).json()
    assert body["match_score"] == 72.0 and body["requirements"] == []


# ── dashboard honesty ────────────────────────────────────────
def test_dashboard_overall_is_a_plain_average_with_its_basis(client, auth, scripted):
    empty = client.get(f"{API}/dashboard/stats", headers=auth).json()
    assert empty["overall_score"] is None and empty["overall_basis"] == [] and "interview_readiness" not in empty
    rid = up(client, auth, STRONG_RESUME)
    ats = client.post(f"{API}/resumes/{rid}/analyze", headers=auth).json()["ats_score"]
    one = client.get(f"{API}/dashboard/stats", headers=auth).json()
    assert one["overall_score"] == round(ats, 1) and one["overall_basis"] == ["Resume ATS score"]
    scripted["reply"] = {"match_score": 40, "skill_match_score": 40, "keyword_match_score": 40, "recommendations": []}
    client.post(f"{API}/job-match/", json={"resume_id": rid, "job_title": "B", "job_description": JOB_DESCRIPTION}, headers=auth)
    two = client.get(f"{API}/dashboard/stats", headers=auth).json()
    assert two["overall_score"] == round((ats + 40) / 2, 1) and two["overall_basis"] == ["Resume ATS score", "Job match"]


# ── recruiter screening ──────────────────────────────────────
def rec_hdr(client):
    t = client.post(f"{API}/auth/login", json={"email": "recruiter@example.com", "password": "DemoPass123!"}).json()["access_token"]
    return {"Authorization": f"Bearer {t}"}


def files(*items):
    return [("files", (name, data, "application/pdf" if name.endswith(".pdf") else "text/plain")) for name, data in items]


def test_screening_ranks_explains_and_rejects(client):
    res = client.post(f"{API}/screening/rank", headers=rec_hdr(client),
                      data={"job_title": "Backend Engineer", "job_description": JOB_DESCRIPTION},
                      files=files(("sneha.pdf", make_pdf(MEDIUM_RESUME)), ("priya.pdf", make_pdf(STRONG_RESUME)),
                                  ("arjun.pdf", make_pdf(WEAK_BULLETS_RESUME)), ("bill.pdf", make_pdf(INVOICE)),
                                  ("priya-copy.pdf", make_pdf(STRONG_RESUME)), ("fake.pdf", b"not a pdf" * 30)))
    assert res.status_code == 200, res.text
    body = res.json()
    names = [c["name"] for c in body["candidates"]]
    assert names == ["Priya Sharma", "Sneha Iyer", "Arjun Mehta"]                      # strongest first
    assert [c["rank"] for c in body["candidates"]] == [1, 2, 3]
    top = body["candidates"][0]
    assert {"Python", "FastAPI", "PostgreSQL", "Docker"} <= set(top["matched_skills"])
    assert "Kubernetes" in top["missing_skills"] and top["skill_coverage"] > body["candidates"][2]["skill_coverage"]
    assert any(f for c in body["candidates"] for f in c["flags"])                      # at least one candidate carries a warning
    rejected = {r["filename"]: r["code"] for r in body["rejected"]}
    assert rejected == {"bill.pdf": "NOT_A_RESUME", "priya-copy.pdf": "DUPLICATE", "fake.pdf": "CORRUPT_FILE"}
    assert "Python" in body["required_skills"] and "Rule-based" in body["method"]


def test_screening_is_deterministic_and_stores_nothing(client):
    from app.db.session import SessionLocal
    from app.models.models import Resume
    db = SessionLocal()
    try:
        before = db.query(Resume).count()
    finally:
        db.close()
    args = dict(headers=rec_hdr(client), data={"job_title": "B", "job_description": JOB_DESCRIPTION},
                files=files(("a.pdf", make_pdf(MEDIUM_RESUME)), ("b.pdf", make_pdf(STRONG_RESUME))))
    first = client.post(f"{API}/screening/rank", **args).json()
    args["files"] = files(("a.pdf", make_pdf(MEDIUM_RESUME)), ("b.pdf", make_pdf(STRONG_RESUME)))
    assert client.post(f"{API}/screening/rank", **args).json() == first
    db = SessionLocal()
    try:
        assert db.query(Resume).count() == before
    finally:
        db.close()


def test_screening_input_rules(client, monkeypatch):
    h = rec_hdr(client)
    no_skills = client.post(f"{API}/screening/rank", headers=h, files=files(("a.pdf", make_pdf(STRONG_RESUME))),
                            data={"job_title": "B", "job_description": "We are looking for a friendly person to join our team. " * 5 +
                                  "Responsibilities include helping customers. Requirements: good communication and experience. Apply now."})
    assert no_skills.status_code == 422 and no_skills.json()["code"] == "NO_SKILLS_IN_JD"
    monkeypatch.setattr(settings, "SCREENING_MAX_FILES", 2)
    many = client.post(f"{API}/screening/rank", headers=h, data={"job_title": "B", "job_description": JOB_DESCRIPTION},
                       files=files(*[(f"{i}.pdf", make_pdf(STRONG_RESUME)) for i in range(3)]))
    assert many.status_code == 422 and many.json()["code"] == "TOO_MANY_FILES"
    bad_jd = client.post(f"{API}/screening/rank", headers=h, data={"job_title": "B", "job_description": "python dev"},
                         files=files(("a.pdf", make_pdf(STRONG_RESUME))))
    assert bad_jd.json()["code"] == "JD_TOO_SHORT"
