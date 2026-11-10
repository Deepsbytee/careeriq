"""Cheap, deterministic "is this a resume?" check. Runs before any AI call.

It scores real resume signals (contact details, standard sections, date
ranges, degrees, bullet points) and subtracts for signals of other document
types (invoices, research papers, long prose). Clear failures are rejected
here for free; borderline cases are passed on and the AI makes the final call.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from app.core.errors import NotAResumeError

REJECT_BELOW = 25   # clearly not a resume
PASS_FROM = 40      # clearly looks like one; AI still double-checks

EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
PHONE = re.compile(
    r"(?<!\d)(?:\+?\d{1,3}[\s-]?)?"
    r"(?:\d{5}[\s-]?\d{5}|\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}|\d{3,4}[\s-]\d{3,4}[\s-]\d{3,4})(?!\d)"
)
LINKS = re.compile(r"(linkedin\.com|github\.com|gitlab\.com|portfolio|behance\.net|leetcode\.com)", re.I)
DATE_RANGE = re.compile(
    r"((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+)?(19|20)\d{2}\s*(?:-|–|—|to)\s*"
    r"(?:(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+)?(?:19|20)\d{2}|present|current|ongoing|now)",
    re.I,
)
_DEGREE_CI = re.compile(
    r"\b(b\.?tech|m\.?tech|b\.?sc|m\.?sc|bca|mca|mba|b\.?com|bachelor'?s?|master'?s?|ph\.?d|diploma|"
    r"cgpa|gpa|university|college|institute of|school of)\b",
    re.I,
)
# Short forms like "BE" are only counted when clearly a degree, never the plain word "be".
_DEGREE_CS = re.compile(
    r"\b(B\.E\.?|B\.A\.?|M\.E\.?|M\.A\.?)(?=\W|$)|\b(BE|ME|BA|MA)\b(?=\s+(?:in|\(|-|Computer|Information|Electronics|Mechanical|Civil|Electrical|CSE|ECE|ISE|Science))"
)


def has_degree(text: str) -> bool:
    return bool(_DEGREE_CI.search(text) or _DEGREE_CS.search(text))


# Section headings, matched at the start of a (short) line.
SECTIONS = {
    "experience": r"(work\s+|professional\s+|relevant\s+)?(experience|employment|work history|internships?)",
    "education": r"(education|academic|qualifications?)",
    "skills": r"(technical\s+|key\s+|core\s+)?(skills|competencies|technologies|tech stack)",
    "projects": r"(personal\s+|academic\s+|key\s+)?projects?",
    "summary": r"(professional\s+)?(summary|objective|profile|about me)",
    "extras": r"(certifications?|achievements?|awards?|publications?|extracurricular|volunteer|positions? of responsibility|languages)",
}
SECTION_RES = {k: re.compile(rf"^\s*{v}\b[\s:&|/-]*$|^\s*{v}\s*(?:[:\-–—|]|$)", re.I) for k, v in SECTIONS.items()}

NEGATIVE_PATTERNS = {
    "an invoice": re.compile(r"\b(invoice|bill to|amount due|total due|subtotal|purchase order|gst(in)?)\b", re.I),
    "a research paper": re.compile(r"\b(abstract|keywords?:|doi:|et al\.|references\s*\n|\[\d+\]|methodology|hypothesis|literature review)\b", re.I),
    "a contract or legal document": re.compile(r"\b(hereinafter|whereas|governing law|indemnif|terms and conditions|party of the)\b", re.I),
    "a job description": re.compile(r"\b(we are looking for|about the role|what you.ll do|responsibilities include|apply now|equal opportunity employer)\b", re.I),
    "course material or an assignment": re.compile(r"\b(assignment|syllabus|lecture|chapter \d|question \d|marks\))\b", re.I),
    "a certificate or letter": re.compile(r"\b(this is to certify|certificate of|dear (sir|madam|hiring)|yours (sincerely|faithfully))\b", re.I),
}


@dataclass
class GateResult:
    score: int
    verdict: str                     # "resume" | "uncertain" | "not_resume"
    signals: dict[str, bool | int] = field(default_factory=dict)
    looks_like: str | None = None

    @property
    def is_clear_reject(self) -> bool:
        return self.verdict == "not_resume"


def assess(text: str) -> GateResult:
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
    head = "\n".join(lines[:15])
    score = 0
    signals: dict[str, bool | int] = {}

    has_email = bool(EMAIL.search(text))
    has_phone = bool(PHONE.search(head)) or bool(PHONE.search(text[:1500]))
    has_links = bool(LINKS.search(text))
    signals.update(email=has_email, phone=has_phone, links=has_links)
    score += 15 if has_email else 0
    score += 8 if has_phone else 0
    score += 5 if has_links else 0

    found = {name for name, rx in SECTION_RES.items() for ln in lines if len(ln) <= 60 and rx.search(ln)}
    signals["sections"] = len(found)
    score += min(len(found), 5) * 11

    ranges = len(DATE_RANGE.findall(text))
    signals["date_ranges"] = ranges
    score += min(ranges, 3) * 4

    has_deg = has_degree(text)
    signals["degree"] = has_deg
    score += 8 if has_deg else 0

    bullets = sum(1 for ln in lines if ln[0] in "•●▪■◦○-*–➢➤►‣")
    signals["bullets"] = bullets
    score += 6 if bullets >= 3 else 0

    # Penalties for other document types and for essay-like prose.
    looks_like = None
    worst = 0
    for label, rx in NEGATIVE_PATTERNS.items():
        n = len(rx.findall(text))
        if n >= 2 and n > worst:
            worst, looks_like = n, label
    if looks_like:
        score -= min(worst * 8, 30)

    long_lines = sum(1 for ln in lines if len(ln) > 220)
    prose_ratio = long_lines / max(len(lines), 1)
    signals["prose_ratio"] = round(prose_ratio, 2)
    if prose_ratio > 0.35:
        score -= 20
        looks_like = looks_like or "long-form prose rather than a resume"

    score = max(0, min(100, score))
    # A resume always tells you who to contact AND what the person did/studied.
    if not (has_email or has_phone) and len(found) < 2:
        score = min(score, REJECT_BELOW - 1)

    verdict = "not_resume" if score < REJECT_BELOW else "resume" if score >= PASS_FROM else "uncertain"
    return GateResult(score=score, verdict=verdict, signals=signals, looks_like=looks_like)


def require_resume(text: str) -> GateResult:
    """Raise NotAResumeError for clear non-resumes. Returns the result otherwise."""
    result = assess(text)
    if result.is_clear_reject:
        raise NotAResumeError(not_a_resume_message(result.looks_like))
    return result


def not_a_resume_message(looks_like: str | None = None) -> str:
    what = f" It looks like {looks_like}." if looks_like else ""
    return (
        "This doesn't look like a resume." + what +
        " Upload a document with your contact details, experience or projects, education, and skills."
    )
