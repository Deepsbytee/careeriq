"""CareerIQ analysis services.

Every result is built from two things: measurements computed in plain Python
(repeatable, explainable) and judgements from the AI (checked against the real
resume text before being shown). There is no mock data anywhere in this file.
"""
from __future__ import annotations

import difflib
import re
from typing import Any, Optional

import httpx
from pydantic import BaseModel, ConfigDict, field_validator

from app.core.config import settings
from app.core.errors import AppError, DocumentError, ExternalServiceError, NotAResumeError
from app.services import llm
from app.services.document_parser import validate_job_description
from app.services.resume_gate import not_a_resume_message
from app.services.resume_insights import invented_numbers, pick_weak_bullets
from app.services.resume_scoring import (
    WEIGHTS, blend, compute_deterministic, extract_skills, overall,
)

PROMPT_VERSION = "resume-v2"
MAX_PROMPT_CHARS = 24_000


# ── Shared helpers ───────────────────────────────────────────
def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9+#.]+", " ", (s or "").lower()).strip()


def quote_found(quote: str, text_norm: str) -> bool:
    """True if ``quote`` really appears in the resume (tolerates PDF line-break noise)."""
    q = _norm(quote)
    if not q:
        return False
    if q in text_norm:
        return True
    q_words, t_words = q.split(), text_norm.split()
    n = len(q_words)
    if n < 3 or len(t_words) < n:
        return False
    best = 0.0
    for i in range(0, len(t_words) - n + 1):
        window = " ".join(t_words[i : i + n])
        best = max(best, difflib.SequenceMatcher(None, q, window).ratio())
        if best >= 0.88:
            return True
    return False


def term_in_text(term: str, text_norm: str) -> bool:
    t = _norm(term)
    return bool(t) and bool(re.search(rf"(?<![a-z0-9+#.]){re.escape(t)}(?![a-z0-9+#])", text_norm))


def _clamp_int(v: Any, lo: int, hi: int) -> int:
    try:
        return int(max(lo, min(hi, round(float(v)))))
    except (TypeError, ValueError):
        raise ValueError("expected a number")


class _Lenient(BaseModel):
    model_config = ConfigDict(coerce_numbers_to_str=True, extra="ignore")


def _str_list(v: Any) -> list[str]:
    if v is None:
        return []
    if isinstance(v, str):
        return [v] if v.strip() else []
    out = []
    for item in v:
        if isinstance(item, dict):  # models sometimes return {"skill": "..."}
            item = next((x for x in item.values() if isinstance(x, str)), "")
        if isinstance(item, str) and item.strip():
            out.append(item.strip())
    return out


# ── Resume analysis ──────────────────────────────────────────
class Rating(_Lenient):
    score: int = 0
    reason: str = ""

    @field_validator("score", mode="before")
    @classmethod
    def _score(cls, v):
        return _clamp_int(v, 0, 10)


class Ratings(_Lenient):
    impact: Rating = Rating()
    relevance: Rating = Rating()
    clarity: Rating = Rating()


class Evidenced(_Lenient):
    point: str
    evidence: str = ""


class Education(_Lenient):
    degree: str = ""
    institution: str = ""
    year: str = ""


class Experience(_Lenient):
    title: str = ""
    company: str = ""
    duration: str = ""
    highlights: list[str] = []

    @field_validator("highlights", mode="before")
    @classmethod
    def _hl(cls, v):
        return _str_list(v)


class ResumeLLM(_Lenient):
    is_resume: bool
    document_type: str = ""
    not_resume_reason: str = ""
    summary: str = ""
    career_level: str = ""
    skills: list[str] = []
    education: list[Education] = []
    experience: list[Experience] = []
    keywords: list[str] = []
    ratings: Ratings = Ratings()
    strengths: list[Evidenced] = []
    weaknesses: list[Evidenced] = []
    recommendations: list[str] = []

    @field_validator("skills", "keywords", "recommendations", mode="before")
    @classmethod
    def _lists(cls, v):
        return _str_list(v)

    @field_validator("strengths", "weaknesses", mode="before")
    @classmethod
    def _evidenced(cls, v):
        out = []
        for item in v or []:
            out.append({"point": item} if isinstance(item, str) else item)
        return out


RESUME_SYSTEM = (
    "You are a senior technical recruiter and ATS specialist reviewing resumes. "
    "Be honest and specific; do not flatter. Reply with ONE JSON object and nothing else.\n" + llm.INJECTION_GUARD
)

RESUME_SCHEMA_HELP = """Return JSON with exactly this structure:
{
  "is_resume": true or false,
  "document_type": "resume | cv | invoice | research paper | job description | cover letter | other",
  "not_resume_reason": "one sentence, only when is_resume is false",
  "summary": "2 sentences describing the candidate and their level, only from the resume",
  "career_level": "student | fresher | junior | mid | senior",
  "skills": ["technical skills literally written in the resume"],
  "education": [{"degree": "", "institution": "", "year": ""}],
  "experience": [{"title": "", "company": "", "duration": "", "highlights": ["short bullet"]}],
  "keywords": ["terms a recruiter or ATS would search for, as written in the resume"],
  "ratings": {
    "impact":    {"score": 0-10, "reason": "why"},
    "relevance": {"score": 0-10, "reason": "why"},
    "clarity":   {"score": 0-10, "reason": "why"}
  },
  "strengths":  [{"point": "what is good", "evidence": "exact quote from the resume, max 20 words"}],
  "weaknesses": [{"point": "what is weak or missing", "evidence": "exact quote showing it, or empty if something is absent"}],
  "recommendations": ["specific, actionable fix, most important first"]
}

Rating guide (0-10):
- impact: 0-2 duties only, no outcomes; 5 some outcomes but few numbers; 8-10 most bullets show measurable results.
- relevance: how well the listed skills are backed by real projects or experience, and how coherent the profile is for one career direction.
- clarity: concise, specific, well-written bullets; 0-2 vague, padded, or full of filler.

Rules:
- First decide whether the text is a resume or CV. If it is not, set is_resume to false, fill document_type and not_resume_reason, and leave everything else empty.
- Give 3-5 strengths, 3-5 weaknesses, and 4-6 recommendations.
- "evidence" must be copied word for word from the resume. If you cannot quote it, leave evidence empty rather than paraphrase.
- Never invent employers, dates, numbers, or skills. When suggesting numbers, use placeholders like [X%]."""


def verify_evidence(items: list[dict], text_norm: str) -> list[dict]:
    """Keep each point, mark whether its quote is real, and drop points with fake quotes."""
    out = []
    for it in items:
        point, quote = (it.get("point") or "").strip(), (it.get("evidence") or "").strip()
        if not point:
            continue
        if not quote:
            out.append({"point": point, "evidence": None, "verified": None})
        elif quote_found(quote, text_norm):
            out.append({"point": point, "evidence": quote, "verified": True})
        # else: the model fabricated a quote, so the whole point is discarded
    return out


def _entry_is_real(values: list[str], text_norm: str) -> bool:
    values = [v for v in values if v and v.strip()]
    return not values or any(_norm(v) and _norm(v) in text_norm for v in values)


def analyze_resume(resume_text: str) -> dict:
    det = compute_deterministic(resume_text)
    text_norm = _norm(resume_text)

    user = (
        RESUME_SCHEMA_HELP
        + "\n\nResume to review:\n"
        + llm.wrap_untrusted("resume", resume_text[:MAX_PROMPT_CHARS])
    )
    ai = llm.generate_json(RESUME_SYSTEM, user, ResumeLLM, temperature=0.1)

    if not ai["is_resume"]:
        reason = (ai.get("not_resume_reason") or "").strip()
        looks = ai.get("document_type") or None
        msg = not_a_resume_message(f"a {looks}" if looks and looks != "other" else None)
        raise NotAResumeError(msg if not reason else f"{msg} ({reason.rstrip('.')}.)")

    ratings = {k: ai["ratings"][k]["score"] for k in ("impact", "relevance", "clarity")}
    scores = blend(det.scores, ratings)
    ats = overall(scores)

    # Skills: parser-found skills first, plus AI-found ones that really appear in the text.
    skills = list(det.features.skills)
    seen = {s.lower() for s in skills}
    for s in ai["skills"]:
        if s.lower() not in seen and term_in_text(s, text_norm):
            skills.append(s)
            seen.add(s.lower())
    keywords = [k for k in dict.fromkeys(ai["keywords"]) if term_in_text(k, text_norm)]

    strengths = verify_evidence(ai["strengths"], text_norm)
    weaknesses = verify_evidence(ai["weaknesses"], text_norm)
    education = [e for e in ai["education"] if _entry_is_real([e["institution"]], text_norm)]
    experience = [e for e in ai["experience"] if _entry_is_real([e["company"], e["title"]], text_norm)]

    def cat(name: str, ai_key: Optional[str] = None) -> dict:
        return {
            "score": scores[name],
            "deterministic": det.scores[name],
            "ai": ratings[ai_key] * 10 if ai_key else None,
            "ai_reason": ai["ratings"][ai_key]["reason"] if ai_key else None,
            "weight": WEIGHTS[name],
        }

    return {
        "ats_score": ats,
        "skills": skills,
        "education": education,
        "experience": experience,
        "keywords": keywords,
        "strengths": [s["point"] for s in strengths],
        "weaknesses": [w["point"] for w in weaknesses],
        "recommendations": ai["recommendations"],
        "summary": ai["summary"],
        "score_breakdown": {
            "categories": {
                "structure": cat("structure"),
                "completeness": cat("completeness"),
                "impact": cat("impact", "impact"),
                "keywords": cat("keywords", "relevance"),
                "readability": cat("readability", "clarity"),
            },
            "findings": det.notes,
            "career_level": ai["career_level"],
        },
        "evidence": {"strengths": strengths, "weaknesses": weaknesses},
        "prompt_version": PROMPT_VERSION,
        "raw_result": {"ai": ai, "deterministic": det.scores},
    }


# ── Job match ────────────────────────────────────────────────
class Requirement(_Lenient):
    requirement: str
    importance: str = "must"
    status: str = "missing"
    evidence: str = ""
    note: str = ""

    @field_validator("importance", mode="before")
    @classmethod
    def _imp(cls, v):
        return "nice" if str(v or "").lower().startswith(("nice", "pref", "bonus", "plus", "opt")) else "must"

    @field_validator("status", mode="before")
    @classmethod
    def _status(cls, v):
        v = str(v or "").lower()
        return "met" if v.startswith(("met", "yes", "full")) else "partial" if v.startswith(("part", "some")) else "missing"


class JobMatchLLM(_Lenient):
    requirements: list[Requirement] = []
    match_score: int = 0
    skill_match_score: int = 0
    keyword_match_score: int = 0
    missing_skills: list[str] = []
    missing_keywords: list[str] = []
    missing_technologies: list[str] = []
    recommendations: list[str] = []

    @field_validator("match_score", "skill_match_score", "keyword_match_score", mode="before")
    @classmethod
    def _pct(cls, v):
        return _clamp_int(v, 0, 100)

    @field_validator("missing_skills", "missing_keywords", "missing_technologies", "recommendations", mode="before")
    @classmethod
    def _lists(cls, v):
        return _str_list(v)


def match_job(resume_text: str, job_description: str) -> dict:
    jd = validate_job_description(job_description)
    resume_norm = _norm(resume_text)
    jd_skills, resume_skills = extract_skills(jd), extract_skills(resume_text)
    covered = [s for s in jd_skills if s.lower() in {r.lower() for r in resume_skills}]
    det_skill_score = round(100 * len(covered) / len(jd_skills)) if len(jd_skills) >= 3 else None

    system = (
        "You are an ATS and hiring specialist comparing one resume with one job description. "
        "Reply with ONE JSON object and nothing else.\n" + llm.INJECTION_GUARD
    )
    facts = (
        f"Parser facts (reliable): skills found in the job description: {jd_skills or 'none recognised'}; "
        f"of those, skills found in the resume: {covered or 'none'}."
    )
    user = f"""{facts}

Return JSON:
{{
  "requirements": [              // the 6-12 most important requirements in the posting
    {{"requirement": "short phrase", "importance": "must | nice", "status": "met | partial | missing",
      "evidence": "exact words copied from the resume that prove it (max 20 words), empty if missing",
      "note": "one short sentence"}}
  ],
  "match_score": 0-100,          // overall fit; weigh required skills 50%, relevant experience 25%, keywords 15%, level fit 10%
  "skill_match_score": 0-100,    // share of required skills the resume demonstrates
  "keyword_match_score": 0-100,  // share of the posting's important terms present in the resume
  "missing_skills": ["required skills the resume lacks"],
  "missing_keywords": ["important posting terms absent from the resume"],
  "missing_technologies": ["tools or technologies in the posting absent from the resume"],
  "recommendations": ["specific, honest actions to improve fit, most important first"]
}}
Evidence must be copied word for word from the resume. Only list something as missing if it truly does not appear anywhere in the resume. Be calibrated: a student with
little relevant experience should not score above 70 for a mid-level role.

{llm.wrap_untrusted("resume", resume_text[:MAX_PROMPT_CHARS // 2])}

{llm.wrap_untrusted("job_description", jd[:MAX_PROMPT_CHARS // 2])}"""
    ai = llm.generate_json(system, user, JobMatchLLM, temperature=0.1)

    # Never tell the user something is missing when it is plainly on their resume.
    def only_truly_missing(items: list[str]) -> list[str]:
        return [i for i in dict.fromkeys(items) if not term_in_text(i, resume_norm)]

    # Check every "proof" quote against the resume. Unprovable claims are labelled, not trusted.
    reqs = []
    for r in ai["requirements"][:15]:
        ev = (r["evidence"] or "").strip()
        verified = bool(ev) and quote_found(ev, resume_norm)
        status = r["status"]
        if status in ("met", "partial") and not verified:
            status = "unverified"
        reqs.append({**r, "status": status, "evidence": ev if verified else None, "verified": verified})
    weight = {"met": 1.0, "partial": 0.5, "unverified": 0.25, "missing": 0.0}
    total = sum(2 if r["importance"] == "must" else 1 for r in reqs)
    req_score = round(100 * sum((2 if r["importance"] == "must" else 1) * weight[r["status"]] for r in reqs) / total) if total else None

    # Final fit: half the AI's holistic view, half the checked requirement coverage.
    final = ai["match_score"] if req_score is None else round(0.5 * ai["match_score"] + 0.5 * req_score)
    skill_score = ai["skill_match_score"]
    if det_skill_score is not None:
        skill_score = round(0.5 * skill_score + 0.5 * det_skill_score)
    return {
        "match_score": float(final),
        "skill_match_score": float(skill_score),
        "keyword_match_score": float(ai["keyword_match_score"]),
        "missing_skills": only_truly_missing(ai["missing_skills"]),
        "missing_keywords": only_truly_missing(ai["missing_keywords"]),
        "missing_technologies": only_truly_missing(ai["missing_technologies"]),
        "recommendations": ai["recommendations"],
        "requirements": reqs,
        "raw_result": {
            "ai": ai, "ai_score": ai["match_score"], "requirement_score": req_score,
            "jd_skills": jd_skills, "covered": covered, "deterministic_skill_score": det_skill_score,
        },
    }


# ── Bullet rewriter ──────────────────────────────────────────
class RewriteItem(_Lenient):
    id: int
    rewritten: str
    why: str = ""


class RewriteLLM(_Lenient):
    rewrites: list[RewriteItem] = []


def rewrite_bullets(resume_text: str) -> dict:
    bullets = pick_weak_bullets(resume_text)
    if not bullets:
        return {"rewrites": [], "considered": 0, "skipped": 0}
    system = (
        "You are a resume coach who rewrites weak bullet points. Reply with ONE JSON object and nothing else.\n"
        + llm.INJECTION_GUARD
    )
    listing = "\n".join(f"{i}: {b}" for i, b in enumerate(bullets))
    user = f"""Rewrite each numbered bullet to be stronger. Return JSON:
{{"rewrites": [{{"id": 0, "rewritten": "improved bullet", "why": "one short sentence on what changed"}}]}}

Rules:
- Start with a strong action verb. Keep it under 25 words. Keep every tool and technology name from the original.
- NEVER invent facts or numbers. Where a figure would help but the original has none, use a placeholder such as [X%], [N users] or [time saved], so the candidate fills in the truth.
- Do not add tools, employers, or responsibilities that the original does not mention.

{llm.wrap_untrusted("bullets", listing)}"""
    ai = llm.generate_json(system, user, RewriteLLM, temperature=0.3)

    out, skipped = [], 0
    for item in ai["rewrites"]:
        if not 0 <= item["id"] < len(bullets):
            continue
        original, new = bullets[item["id"]], item["rewritten"].strip()
        if not new or _norm(new) == _norm(original) or invented_numbers(original, new):
            skipped += 1   # unchanged, or it made up a figure: never show it
            continue
        out.append({"original": original, "rewritten": new, "why": item["why"]})
    return {"rewrites": out, "considered": len(bullets), "skipped": skipped}


# ── Recruiter simulation ─────────────────────────────────────
class InterviewQ(_Lenient):
    question: str
    type: str = "technical"


class RecruiterLLM(_Lenient):
    shortlist_probability: int = 0
    recruiter_notes: str = ""
    strengths: list[str] = []
    weaknesses: list[str] = []
    risk_factors: list[str] = []
    hiring_recommendation: str = "Maybe"
    interview_questions: list[InterviewQ] = []

    @field_validator("shortlist_probability", mode="before")
    @classmethod
    def _pct(cls, v):
        return _clamp_int(v, 0, 100)

    @field_validator("strengths", "weaknesses", "risk_factors", mode="before")
    @classmethod
    def _lists(cls, v):
        return _str_list(v)

    @field_validator("hiring_recommendation", mode="before")
    @classmethod
    def _rec(cls, v):
        s = str(v or "").strip().lower()
        return {"strong yes": "Strong Yes", "yes": "Yes", "maybe": "Maybe", "no": "No"}.get(s, "Maybe")


def simulate_recruiter(resume_text: str) -> dict:
    system = (
        "You are a senior technical recruiter at a competitive product company screening resumes. "
        "Be candid and calibrated. Reply with ONE JSON object and nothing else.\n" + llm.INJECTION_GUARD
    )
    user = f"""Screen this resume and return JSON:
{{
  "shortlist_probability": 0-100,
  "recruiter_notes": "an honest 2-3 sentence assessment",
  "strengths": ["..."],
  "weaknesses": ["..."],
  "risk_factors": ["things that would worry a hiring manager"],
  "hiring_recommendation": "Strong Yes | Yes | Maybe | No",
  "interview_questions": [{{"question": "", "type": "technical | behavioral | situational"}}]
}}
Calibration: most student resumes without internships or measurable results land between 20 and 55.
Reserve 75+ for resumes with clear, quantified achievements. Base every point on what is written. Ask 5 interview questions
that reference the candidate's actual projects or experience.

{llm.wrap_untrusted("resume", resume_text[:MAX_PROMPT_CHARS])}"""
    ai = llm.generate_json(system, user, RecruiterLLM, temperature=0.2)
    ai["shortlist_probability"] = float(ai["shortlist_probability"])
    return {**ai, "raw_result": {"ai": ai}}


# ── Interview prep ───────────────────────────────────────────
class QA(_Lenient):
    question: str
    expected_answer: str = ""
    evaluation_criteria: str = ""


class InterviewLLM(_Lenient):
    technical_questions: list[QA] = []
    behavioral_questions: list[QA] = []
    project_questions: list[QA] = []


def generate_interview_prep(job_role: str, resume_text: Optional[str] = None) -> dict:
    role = (job_role or "").strip()
    if len(role) < 2:
        raise DocumentError("Enter the role you're preparing for, for example 'Backend Engineer'.", code="INVALID_ROLE")
    system = (
        "You are an experienced technical interviewer. Reply with ONE JSON object and nothing else.\n"
        + llm.INJECTION_GUARD
    )
    resume_part = (
        "Tailor the project questions to the projects and experience actually listed in this resume:\n"
        + llm.wrap_untrusted("resume", resume_text[: MAX_PROMPT_CHARS // 2])
        if resume_text
        else "No resume was provided, so keep project questions general to this role."
    )
    user = f"""Create interview preparation for the role: {role[:120]!r}.
Return JSON:
{{
  "technical_questions":  [{{"question": "", "expected_answer": "", "evaluation_criteria": ""}}],
  "behavioral_questions": [{{"question": "", "expected_answer": "", "evaluation_criteria": ""}}],
  "project_questions":    [{{"question": "", "expected_answer": "", "evaluation_criteria": ""}}]
}}
Write exactly 4 questions per list. Keep each expected answer to 2-4 sentences.

{resume_part}"""
    ai = llm.generate_json(system, user, InterviewLLM, temperature=0.4)
    return {**ai, "raw_result": {"ai": ai}}


# ── Portfolio (real GitHub data only) ────────────────────────
_GH_USER = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$")


def _parse_github_username(value: str) -> str:
    from urllib.parse import urlparse

    v = (value or "").strip()
    if "github.com" in v.lower():
        parsed = urlparse(v if "://" in v else f"https://{v}")
        v = parsed.path.strip("/").split("/")[0]
    v = v.lstrip("@").strip()
    if not _GH_USER.match(v):
        raise DocumentError("That doesn't look like a GitHub username. Enter it like 'octocat'.", code="INVALID_USERNAME")
    return v


def analyze_portfolio(github_username: str) -> dict:
    from datetime import datetime, timezone

    username = _parse_github_username(github_username)
    headers = {"Accept": "application/vnd.github+json"}
    if settings.GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {settings.GITHUB_TOKEN}"
    try:
        r = httpx.get(
            f"https://api.github.com/users/{username}/repos",
            params={"per_page": 100, "sort": "pushed"},
            headers=headers,
            timeout=12.0,
        )
    except httpx.HTTPError:
        raise ExternalServiceError("Couldn't reach GitHub. Check your connection and try again.")
    if r.status_code == 404:
        raise AppError(f"No GitHub user named '{username}' was found.", code="GITHUB_USER_NOT_FOUND", status_code=404)
    if r.status_code in (403, 429):
        raise AppError(
            "GitHub's rate limit was reached. Try again in a few minutes, or add GITHUB_TOKEN to your .env file.",
            code="GITHUB_RATE_LIMITED",
            status_code=503,
        )
    if r.status_code != 200 or not isinstance(r.json(), list):
        raise ExternalServiceError("GitHub returned an unexpected response. Try again later.")

    repos = [x for x in r.json() if not x.get("fork")]
    languages: dict[str, int] = {}
    for repo in repos:
        if repo.get("language"):
            languages[repo["language"]] = languages.get(repo["language"], 0) + 1
    stars = sum(x.get("stargazers_count", 0) for x in repos)
    described = sum(1 for x in repos if (x.get("description") or "").strip())
    now = datetime.now(timezone.utc)

    def days_since(ts: str | None) -> int:
        if not ts:
            return 9999
        return (now - datetime.fromisoformat(ts.replace("Z", "+00:00"))).days

    recent = sum(1 for x in repos if days_since(x.get("pushed_at")) <= 180)
    n = len(repos)
    score = (
        min(n, 10) * 4                                 # up to 40: number of original repos
        + (described / n * 20 if n else 0)             # up to 20: repos with descriptions
        + (recent / n * 20 if n else 0)                # up to 20: recently active
        + min(stars, 10)                               # up to 10: stars
        + min(len(languages), 4) * 2.5                 # up to 10: language variety
    )
    score = round(min(score, 100), 1)
    readiness = "High" if score >= 70 else "Medium" if score >= 40 else "Low"

    suggestions: list[str] = []
    if n == 0:
        suggestions.append("Publish at least 3 original projects. Forks don't count toward your score.")
    if 0 < n < 5:
        suggestions.append("Add more original projects to show range. You have " + str(n) + " so far.")
    if n and described < n:
        suggestions.append(f"{n - described} of your {n} repositories have no description. Add a one-line summary to each.")
    if n and recent / n < 0.5:
        suggestions.append("Most repositories haven't been updated in 6 months. Keep your best projects active.")
    if stars == 0 and n:
        suggestions.append("None of your projects have stars yet. Share your best one and polish its README.")
    suggestions.append("Pin your best 6 repositories on your GitHub profile.")
    suggestions.append("Add live demo links and screenshots to your top project READMEs.")

    return {
        "repo_count": n,
        "languages": languages,
        "portfolio_score": score,
        "internship_readiness": readiness,
        "suggestions": suggestions,
        "raw_result": {"username": username, "stars": stars, "recent_repos": recent, "described_repos": described},
    }
