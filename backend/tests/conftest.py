import io
import os
import sys
import tempfile
import textwrap
from pathlib import Path

# Must be set before the app is imported so tests never touch the real database.
_TMP = tempfile.mkdtemp(prefix="careeriq-test-")
os.environ["DATABASE_URL"] = f"sqlite:///{_TMP}/test.db"
os.environ["AI_PROVIDER"] = "gemini"
os.environ["GEMINI_API_KEY"] = ""
os.environ["SECRET_KEY"] = "test-secret-key-that-is-long-enough-1234567890"
os.environ["AUTH_ATTEMPTS_PER_MINUTE"] = "1000"
os.environ["AI_BURST_PER_MINUTE"] = "1000"
os.environ["AI_DAILY_LIMIT"] = "100000"

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import pytest
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from samples import STRONG_RESUME


def make_pdf(text: str, pages_min: int = 1, encrypt: str | None = None) -> bytes:
    buf = io.BytesIO()
    kwargs = {}
    if encrypt:
        from reportlab.lib.pdfencrypt import StandardEncryption
        kwargs["encrypt"] = StandardEncryption(encrypt, canPrint=1)
    c = canvas.Canvas(buf, pagesize=A4, **kwargs)
    w, h = A4
    y, pages = h - 40, 1
    c.setFont("Helvetica", 9)
    for raw in text.split("\n"):
        for line in (textwrap.wrap(raw, 105) or [""]):
            if y < 40:
                c.showPage()
                c.setFont("Helvetica", 9)
                y = h - 40
                pages += 1
            c.drawString(40, y, line)
            y -= 12
    while pages < pages_min:
        c.showPage()
        c.setFont("Helvetica", 9)
        c.drawString(40, h - 40, "filler page")
        pages += 1
    c.save()
    return buf.getvalue()


def make_scanned_pdf() -> bytes:
    """A page that only contains a drawn shape, like a scanned image: no text layer."""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    c.rect(50, 50, 400, 600, fill=1)
    c.save()
    return buf.getvalue()


def make_docx(paragraphs: list[str], table_rows: list[list[str]] | None = None) -> bytes:
    import docx
    d = docx.Document()
    for p in paragraphs:
        d.add_paragraph(p)
    if table_rows:
        t = d.add_table(rows=len(table_rows), cols=len(table_rows[0]))
        for i, row in enumerate(table_rows):
            for j, val in enumerate(row):
                t.cell(i, j).text = val
    buf = io.BytesIO()
    d.save(buf)
    return buf.getvalue()


def fake_ai_resume(**overrides) -> dict:
    """A valid AI reply for STRONG_RESUME. One fabricated quote and one invented skill are included on purpose."""
    base = {
        "is_resume": True,
        "document_type": "resume",
        "not_resume_reason": "",
        "summary": "Final-year CS student with full-stack project and internship experience.",
        "career_level": "student",
        "skills": ["Python", "FastAPI", "Kubernetes", "Terraform"],  # last two are NOT in the resume
        "education": [{"degree": "B.E. Computer Science", "institution": "K S School of Engineering", "year": 2027},
                      {"degree": "MBA", "institution": "Harvard Business School", "year": "2030"}],  # invented
        "experience": [{"title": "Software Development Intern", "company": "Oasis Infobyte", "duration": "Jun 2025 - Jul 2025",
                        "highlights": ["Built 6 REST API endpoints"]}],
        "keywords": ["FastAPI", "REST", "blockchain"],  # blockchain is not in the resume
        "ratings": {"impact": {"score": 8, "reason": "Most bullets have numbers."},
                    "relevance": {"score": 7, "reason": "Skills backed by projects."},
                    "clarity": {"score": 8, "reason": "Concise bullets."}},
        "strengths": [
            {"point": "Quantified internship results", "evidence": "cutting average response time by 35%"},
            {"point": "Won a Nobel prize", "evidence": "Awarded the Nobel Prize in Physics in 2026"},  # fabricated quote
        ],
        "weaknesses": [
            {"point": "No live deployment links", "evidence": ""},
            {"point": "Projects lack user numbers", "evidence": "Designed JWT authentication and role-based access control"},
        ],
        "recommendations": ["Add live demo links to both projects.", "Quantify TaskFlow's real-world usage."],
    }
    base.update(overrides)
    return base


@pytest.fixture(autouse=True)
def _fresh_limiter():
    from app.core.ratelimit import limiter
    limiter.reset()
    yield
    limiter.reset()


@pytest.fixture
def strong_pdf():
    return make_pdf(STRONG_RESUME)


@pytest.fixture(scope="session")
def client():
    from fastapi.testclient import TestClient
    from app.main import app
    with TestClient(app) as c:
        yield c


@pytest.fixture
def auth(client):
    import uuid
    email = f"user-{uuid.uuid4().hex[:8]}@example.com"
    r = client.post("/api/v1/auth/register", json={"email": email, "full_name": "Test User", "password": "Passw0rd!x"})
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture
def ai_on(monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "test-key")
