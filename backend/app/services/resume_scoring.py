"""Deterministic resume scoring. No AI, no randomness: same text, same numbers.

These measurements are the "hard" half of the ATS score. The AI supplies the
"soft" half (quality of content) and the two are blended in ``blend``.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from app.services.resume_gate import DATE_RANGE, EMAIL, PHONE, SECTION_RES, has_degree

# category -> display names. Matching is case-insensitive and token-aware.
SKILL_LEXICON: dict[str, list[str]] = {
    "languages": [
        "Python", "Java", "JavaScript", "TypeScript", "C++", "C#", "Golang", "Rust", "Kotlin", "Swift",
        "PHP", "Ruby", "Scala", "SQL", "Bash", "Dart", "MATLAB", "HTML", "CSS", "Shell",
    ],
    "frameworks": [
        "React", "Angular", "Vue", "Next.js", "Node.js", "Express", "Django", "Flask", "FastAPI",
        "Spring Boot", ".NET", "Laravel", "Tailwind", "Bootstrap", "Redux", "Flutter", "React Native",
        "jQuery", "TensorFlow", "PyTorch", "Scikit-learn", "Keras", "Pandas", "NumPy", "OpenCV", "Streamlit",
    ],
    "databases": [
        "PostgreSQL", "MySQL", "MongoDB", "SQLite", "Redis", "Firebase", "Oracle", "DynamoDB",
        "Cassandra", "Elasticsearch", "SQL Server", "Supabase",
    ],
    "tools_cloud": [
        "Docker", "Kubernetes", "AWS", "Azure", "GCP", "Git", "GitHub", "GitLab", "Jenkins", "Linux",
        "CI/CD", "Terraform", "Nginx", "Postman", "Jira", "Figma", "Vercel", "Heroku", "Netlify",
        "GitHub Actions", "Ansible", "Kafka", "RabbitMQ", "Power BI", "Tableau",
    ],
    "concepts": [
        "REST", "GraphQL", "Microservices", "JWT", "OAuth", "RBAC", "Agile", "Scrum", "TDD",
        "Unit Testing", "Data Structures", "Algorithms", "OOP", "Machine Learning", "Deep Learning",
        "NLP", "Computer Vision", "System Design", "DevOps", "Web Development", "Data Analysis",
    ],
}
ALIASES = {
    "postgres": "PostgreSQL", "reactjs": "React", "react.js": "React", "nodejs": "Node.js",
    "node js": "Node.js", "vuejs": "Vue", "vue.js": "Vue", "k8s": "Kubernetes", "golang": "Golang",
    "restful": "REST", "rest api": "REST", "rest apis": "REST", "restful api": "REST", "restful apis": "REST",
    "ml": "Machine Learning", "dsa": "Data Structures", "oops": "OOP", "expressjs": "Express",
    "express.js": "Express", "mongo": "MongoDB", "sklearn": "Scikit-learn", "scikit learn": "Scikit-learn",
    "js": "JavaScript", "ts": "TypeScript",
}
_CATEGORY_OF = {name: cat for cat, names in SKILL_LEXICON.items() for name in names}


def _skill_regex(token: str) -> re.Pattern[str]:
    return re.compile(rf"(?<![\w+#.]){re.escape(token.lower())}(?![\w+#])", re.I)


_SKILL_PATTERNS = [(name, _skill_regex(name)) for name in _CATEGORY_OF] + [
    (display, _skill_regex(alias)) for alias, display in ALIASES.items()
]

ACTION_VERBS = set("""
accelerated achieved administered analyzed analysed architected authored automated boosted built
collaborated configured conducted consolidated containerized contributed converted coordinated created
customized debugged decreased delivered deployed designed developed devised directed documented drove
eliminated enabled engineered enhanced established evaluated executed expanded facilitated finalized
fixed formulated generated guided identified implemented improved increased initiated integrated
introduced investigated launched led leveraged maintained managed mentored migrated modernized monitored
negotiated optimized orchestrated organized overhauled owned partnered performed pioneered planned
presented prioritized produced programmed prototyped published reduced refactored released remodeled
replaced researched resolved restructured revamped reviewed scaled secured shipped simplified solved
spearheaded standardized streamlined strengthened supported tested trained transformed translated
troubleshot upgraded validated visualized wrote won
""".split())

WEAK_PHRASES = [
    "responsible for", "worked on", "helped with", "helped in", "duties included", "tasked with",
    "team player", "hard-working", "hardworking", "hard working", "results-oriented", "detail-oriented",
    "go-getter", "self-motivated", "passionate about", "various tasks",
]
PRONOUN = re.compile(r"\b(i|my|me|myself)\b", re.I)
BULLET_CHARS = "•●▪■◦○➢➤►‣-*–"
METRIC = re.compile(r"\d")  # any figure: 40%, 3x, 10k users, $2M, 5 services...

# weights for the overall ATS score
WEIGHTS = {"structure": 0.20, "completeness": 0.15, "impact": 0.30, "keywords": 0.20, "readability": 0.15}


@dataclass
class Features:
    words: int = 0
    bullets: list[str] = field(default_factory=list)
    sections: set[str] = field(default_factory=set)
    has_email: bool = False
    has_phone: bool = False
    has_linkedin: bool = False
    has_github: bool = False
    has_portfolio: bool = False
    date_ranges: int = 0
    has_degree: bool = False
    metric_bullets: int = 0
    action_bullets: int = 0
    long_bullets: int = 0
    weak_phrases: list[str] = field(default_factory=list)
    pronouns: int = 0
    avg_bullet_words: float = 0.0
    skills: list[str] = field(default_factory=list)
    skill_categories: set[str] = field(default_factory=set)


@dataclass
class DeterministicResult:
    features: Features
    scores: dict[str, int]          # structure, completeness, impact, keywords, readability (0-100)
    notes: list[str]                # plain-English findings


def extract_skills(text: str) -> list[str]:
    found: list[str] = []
    for display, pattern in _SKILL_PATTERNS:
        if display not in found and pattern.search(text):
            found.append(display)
    return found


def _split_sections(lines: list[str]) -> tuple[dict[str, list[str]], set[str]]:
    current = "header"
    out: dict[str, list[str]] = {"header": []}
    seen: set[str] = set()
    for ln in lines:
        matched = None
        if len(ln) <= 60:
            for name, rx in SECTION_RES.items():
                if rx.search(ln):
                    matched = name
                    break
        if matched:
            current = matched
            seen.add(matched)
            out.setdefault(current, [])
            continue
        out.setdefault(current, []).append(ln)
    return out, seen


def extract_features(text: str) -> Features:
    f = Features()
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
    low = text.lower()
    f.words = len(text.split())
    f.has_email = bool(EMAIL.search(text))
    f.has_phone = bool(PHONE.search(text[:1500]))
    f.has_linkedin = "linkedin.com" in low or "linkedin" in low
    f.has_github = "github.com" in low or "github" in low
    f.has_portfolio = any(k in low for k in ("portfolio", "behance.net", "leetcode.com", "kaggle.com", "http", "www."))
    f.date_ranges = len(DATE_RANGE.findall(text))
    f.has_degree = has_degree(text)

    sections, seen = _split_sections(lines)
    f.sections = seen

    bullets = [ln.lstrip(BULLET_CHARS + " ").strip() for ln in lines if ln[0] in BULLET_CHARS and len(ln.split()) >= 3]
    if len(bullets) < 3:  # PDFs often lose bullet glyphs: fall back to sentence-like lines
        pool = sections.get("experience", []) + sections.get("projects", [])
        bullets = [ln.lstrip(BULLET_CHARS + " ").strip() for ln in pool
                   if len(ln.split()) >= 7 and not DATE_RANGE.fullmatch(ln.strip())]
    f.bullets = bullets

    for b in bullets:
        n = len(b.split())
        first = re.sub(r"[^a-z]", "", b.split()[0].lower()) if b.split() else ""
        if METRIC.search(b):
            f.metric_bullets += 1
        if first in ACTION_VERBS:
            f.action_bullets += 1
        if n > 40:
            f.long_bullets += 1
    f.avg_bullet_words = sum(len(b.split()) for b in bullets) / len(bullets) if bullets else 0.0

    f.weak_phrases = [p for p in WEAK_PHRASES if p in low]
    f.pronouns = len(PRONOUN.findall(" ".join(bullets + sections.get("summary", []))))
    f.skills = extract_skills(text)
    f.skill_categories = {_CATEGORY_OF[s] for s in f.skills if s in _CATEGORY_OF}
    return f


def _clamp(x: float) -> int:
    return int(max(0, min(100, round(x))))


def score_structure(f: Features) -> int:
    pts = 0
    pts += 30 if ({"experience", "projects"} & f.sections) else 0
    pts += 5 if {"experience", "projects"} <= f.sections else 0
    pts += 22 if "education" in f.sections else 0
    pts += 22 if "skills" in f.sections else 0
    pts += 8 if "summary" in f.sections else 0
    pts += 5 if "extras" in f.sections else 0
    pts += 8 if f.date_ranges >= 2 else (4 if f.date_ranges == 1 else 0)
    if f.words < 120:
        pts -= 35
    elif f.words < 200:
        pts -= 20
    elif f.words > 1500:
        pts -= 30
    elif f.words > 1100:
        pts -= 15
    return _clamp(pts)


def score_completeness(f: Features) -> int:
    pts = 0
    pts += 25 if f.has_email else 0
    pts += 15 if f.has_phone else 0
    pts += 15 if f.has_linkedin else 0
    pts += 15 if (f.has_github or f.has_portfolio) else 0
    pts += 10 if f.has_degree else 0
    pts += 10 if len(f.skills) >= 3 else 0
    pts += 10 if len(f.bullets) >= 6 else 0
    return _clamp(pts)


def score_impact(f: Features) -> int:
    if not f.bullets:
        return 20
    n = len(f.bullets)
    metric_ratio = f.metric_bullets / n
    action_ratio = f.action_bullets / n
    pts = min(metric_ratio / 0.4, 1) * 50
    pts += min(action_ratio / 0.6, 1) * 35
    pts += 15 - min(len(f.weak_phrases) * 5, 15)
    return _clamp(pts)


def score_keywords(f: Features) -> int:
    pts = min(len(f.skills) / 12, 1) * 70
    pts += min(len(f.skill_categories) / 5, 1) * 30
    return _clamp(pts)


def score_readability(f: Features) -> int:
    pts = 100.0
    if f.bullets:
        a = f.avg_bullet_words
        if a < 8:
            pts -= min((8 - a) * 4, 30)
        elif a > 26:
            pts -= min((a - 26) * 3, 30)
        pts -= min(f.long_bullets / len(f.bullets) * 40, 20)
    else:
        pts -= 30
    if len(f.bullets) < 6:
        pts -= 15
    pts -= min(f.pronouns * 5, 25)
    pts -= min(len(f.weak_phrases) * 5, 15)
    return _clamp(pts)


def build_notes(f: Features) -> list[str]:
    notes: list[str] = []
    n = len(f.bullets)
    if n:
        notes.append(f"{f.metric_bullets} of {n} bullet points include a number or measurable result.")
        notes.append(f"{f.action_bullets} of {n} bullet points start with a strong action verb.")
    else:
        notes.append("No bullet points were detected, so achievements can't be measured.")
    missing = [s for s in ("experience", "projects", "education", "skills") if s not in f.sections]
    if missing:
        notes.append("Missing standard sections: " + ", ".join(missing) + ".")
    if not f.has_linkedin:
        notes.append("No LinkedIn link found.")
    if not (f.has_github or f.has_portfolio):
        notes.append("No GitHub or portfolio link found.")
    if f.weak_phrases:
        notes.append("Weak phrases found: " + ", ".join(f'"{p}"' for p in f.weak_phrases[:4]) + ".")
    if f.pronouns:
        notes.append("First-person pronouns (I, my) appear in the bullet points.")
    notes.append(f"{len(f.skills)} recognised technical skills across {len(f.skill_categories)} categories.")
    return notes


def compute_deterministic(text: str) -> DeterministicResult:
    f = extract_features(text)
    scores = {
        "structure": score_structure(f),
        "completeness": score_completeness(f),
        "impact": score_impact(f),
        "keywords": score_keywords(f),
        "readability": score_readability(f),
    }
    return DeterministicResult(features=f, scores=scores, notes=build_notes(f))


def blend(det: dict[str, int], llm_ratings: dict[str, int | None]) -> dict[str, int]:
    """Blend deterministic scores with the AI's 0-10 ratings (50/50 where both exist)."""
    ai_for = {"impact": "impact", "keywords": "relevance", "readability": "clarity"}
    out = dict(det)
    for cat, rating_key in ai_for.items():
        r = llm_ratings.get(rating_key)
        if r is not None:
            out[cat] = _clamp(0.5 * det[cat] + 0.5 * (r * 10))
    return out


def overall(scores: dict[str, int]) -> float:
    return round(sum(scores[k] * w for k, w in WEIGHTS.items()), 1)
