from samples import STRONG_RESUME, WEAK_RESUME

from app.services.document_parser import normalise_text
from app.services.resume_scoring import (
    WEIGHTS, blend, compute_deterministic, extract_skills, overall,
)


def test_weights_sum_to_one():
    assert abs(sum(WEIGHTS.values()) - 1.0) < 1e-9


def test_strong_beats_weak_by_a_wide_margin():
    s = compute_deterministic(normalise_text(STRONG_RESUME))
    w = compute_deterministic(normalise_text(WEAK_RESUME))
    assert overall(s.scores) >= 80
    assert overall(w.scores) <= 35
    assert overall(s.scores) - overall(w.scores) >= 45


def test_scoring_is_deterministic():
    t = normalise_text(STRONG_RESUME)
    assert compute_deterministic(t).scores == compute_deterministic(t).scores


def test_metrics_and_action_verbs_are_counted():
    f = compute_deterministic(normalise_text(STRONG_RESUME)).features
    assert len(f.bullets) >= 10
    assert f.metric_bullets >= 7 and f.action_bullets >= 9
    assert f.has_email and f.has_phone and f.has_linkedin and f.has_github


def test_weak_phrases_and_pronouns_are_flagged():
    r = compute_deterministic(normalise_text(WEAK_RESUME))
    assert "responsible for" in r.features.weak_phrases
    assert any("Weak phrases" in n for n in r.notes)


def test_skill_extraction_is_token_aware():
    assert "Java" not in extract_skills("I know JavaScript and TypeScript")
    assert "SQL" not in extract_skills("Worked with MySQL and PostgreSQL")
    assert {"MySQL", "PostgreSQL"} <= set(extract_skills("Worked with MySQL and PostgreSQL"))
    assert {"C++", "C#", ".NET", "Node.js", "CI/CD"} <= set(extract_skills("C++, C#, .NET, Node.js and CI/CD pipelines"))
    assert "Kubernetes" in extract_skills("deployed on k8s")
    assert "Go" not in extract_skills("ready to go the extra mile")


def test_blend_uses_ai_only_where_present():
    det = {"structure": 90, "completeness": 80, "impact": 40, "keywords": 60, "readability": 70}
    out = blend(det, {"impact": 10, "relevance": 0, "clarity": None})
    assert out["structure"] == 90 and out["completeness"] == 80          # never touched by the AI
    assert out["impact"] == 70                                            # (40 + 100) / 2
    assert out["keywords"] == 30                                          # (60 + 0) / 2
    assert out["readability"] == 70                                       # no AI rating -> unchanged


def test_empty_text_does_not_crash():
    r = compute_deterministic("")
    assert all(0 <= v <= 100 for v in r.scores.values())


# ── resumes that arrive as real PDFs (bullet glyphs differ from plain text) ──
def test_pdf_extracted_bullets_are_still_recognised():
    """Regression: a PDF's bullet came out as a DEL control character and every action verb went uncounted."""
    from conftest import make_pdf

    from app.services.document_parser import parse_upload

    doc = parse_upload("p.pdf", make_pdf(STRONG_RESUME))
    assert "\x7f" not in doc.text
    f = compute_deterministic(doc.text).features
    assert len(f.bullets) >= 10 and f.action_bullets >= 8 and f.metric_bullets >= 7
    assert abs(overall(compute_deterministic(doc.text).scores) - overall(compute_deterministic(normalise_text(STRONG_RESUME)).scores)) < 3


def test_odd_bullet_glyphs_become_plain_bullets():
    raw = "\x7f Built a thing\n\u00b7 Made a thing\n\u2713 Shipped a thing\n\x01\x02Fixed a thing\nKept\x00 inside\x1f text"
    out = normalise_text(raw).split("\n")
    assert out[:4] == ["\u2022 Built a thing", "\u2022 Made a thing", "\u2022 Shipped a thing", "\u2022 Fixed a thing"]
    assert out[4] == "Kept inside text"
