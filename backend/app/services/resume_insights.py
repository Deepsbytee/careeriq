"""Rule-based insights computed straight from the resume text (no AI, no cost)."""
from __future__ import annotations

import re

from app.services.resume_scoring import ACTION_VERBS, METRIC, WEAK_PHRASES, extract_features

_NAME_OK = re.compile(r"^[A-Za-z][A-Za-z.'\- ]{1,60}$")
_NUM = re.compile(r"\d+(?:\.\d+)?")


def guess_name(text: str) -> str | None:
    for line in text.split("\n"):
        line = line.strip()
        if not line:
            continue
        words = line.split()
        if 1 <= len(words) <= 4 and _NAME_OK.match(line) and "@" not in line:
            return line.title() if line.isupper() else line
        return None  # the first non-empty line isn't a name
    return None


def _count(skill: str, text_low: str) -> int:
    return len(re.findall(rf"(?<![\w+#.]){re.escape(skill.lower())}(?![\w+#])", text_low))


def six_second_scan(text: str, analysis: dict | None = None) -> dict:
    """What a recruiter's first glance can pick up, and what is easy to miss."""
    f = extract_features(text)
    low = text.lower()
    name = guess_name(text)
    skills = sorted(f.skills, key=lambda s: -_count(s, low))[:6]

    role = education = None
    if analysis:
        exp = (analysis.get("experience") or [None])[0]
        if exp and (exp.get("title") or exp.get("company")):
            role = " at ".join(x for x in (exp.get("title"), exp.get("company")) if x)
        edu = (analysis.get("education") or [None])[0]
        if edu and (edu.get("degree") or edu.get("institution")):
            education = ", ".join(x for x in (edu.get("degree"), edu.get("institution")) if x)

    notes: list[dict] = []

    def add(kind: str, msg: str) -> None:
        notes.append({"kind": kind, "text": msg})

    add("good" if name else "warn",
        "Your name is clear at the top." if name else "Your name isn't clearly the first line, so a skimmer may not find it.")
    if f.has_email and f.has_phone:
        add("good", "Email and phone are both easy to find.")
    else:
        add("warn", "Add " + ("a phone number" if f.has_email else "an email address" if f.has_phone else "an email and phone number") + " near the top.")
    linked = [n for n, ok in (("LinkedIn", f.has_linkedin), ("GitHub", f.has_github)) if ok]
    if linked:
        add("good", "You link to " + " and ".join(linked) + ".")
    if not f.has_linkedin:
        add("warn", "No LinkedIn link. Recruiters usually check it before replying.")
    if not (f.has_github or f.has_portfolio):
        add("warn", "No GitHub or portfolio link, so recruiters can't verify your work in one click.")
    n = len(f.bullets)
    if n:
        ratio = f.metric_bullets / n
        add("good" if ratio >= 0.4 else "warn",
            f"{f.metric_bullets} of {n} bullet points contain a number, which is what makes results stand out."
            if ratio >= 0.4 else f"Only {f.metric_bullets} of {n} bullet points contain a number. Results without figures are easy to skip.")
    if f.words < 250:
        add("warn", f"At {f.words} words this is thin. Recruiters expect more evidence of what you've done.")
    elif f.words > 900:
        add("warn", f"At {f.words} words this is long. Trim to the strongest points.")
    else:
        add("good", f"At {f.words} words the length is about right.")
    if len(f.skills) < 5:
        add("warn", f"Only {len(f.skills)} recognisable technical skills. Name your tools explicitly.")

    return {
        "name": name,
        "latest_role": role,
        "education": education,
        "top_skills": skills,
        "signals": {"email": f.has_email, "phone": f.has_phone, "linkedin": f.has_linkedin, "github": f.has_github},
        "notes": notes,
    }


def pick_weak_bullets(text: str, limit: int = 5) -> list[str]:
    """The bullets most worth rewriting: no figures, weak opening, filler phrases, or too short/long."""
    f = extract_features(text)
    scored: list[tuple[int, int, str]] = []
    for i, b in enumerate(f.bullets):
        words = b.split()
        first = re.sub(r"[^a-z]", "", words[0].lower()) if words else ""
        pts = 0
        pts += 0 if METRIC.search(b) else 2
        pts += 0 if first in ACTION_VERBS else 2
        pts += 2 if any(p in b.lower() for p in WEAK_PHRASES) else 0
        pts += 1 if len(words) < 7 or len(words) > 35 else 0
        if pts >= 2:
            scored.append((-pts, i, b))
    scored.sort()
    return [b for _, _, b in scored[:limit]]


def invented_numbers(original: str, rewritten: str) -> list[str]:
    """Numbers in a rewrite that weren't in the original. [X%]-style placeholders are allowed."""
    allowed = set(_NUM.findall(original.replace(",", "")))
    stripped = re.sub(r"\[[^\]]*\]", "", rewritten).replace(",", "")
    return [n for n in _NUM.findall(stripped) if n not in allowed]
