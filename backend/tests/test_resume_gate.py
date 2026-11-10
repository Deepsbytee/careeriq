import pytest
from samples import INVOICE, JOB_DESCRIPTION, LOREM, RESEARCH_PAPER, STRONG_RESUME, WEAK_RESUME

from app.core.errors import NotAResumeError
from app.services.document_parser import normalise_text
from app.services.resume_gate import assess, require_resume


def test_strong_resume_passes():
    r = assess(normalise_text(STRONG_RESUME))
    assert r.verdict == "resume" and r.score >= 80
    assert r.signals["email"] and r.signals["phone"] and r.signals["sections"] >= 5


def test_poor_but_real_resume_is_not_rejected():
    """A bad resume is still a resume: it should be scored low, not turned away."""
    assert assess(normalise_text(WEAK_RESUME)).verdict != "not_resume"


@pytest.mark.parametrize("text,label", [
    (INVOICE, "invoice"),
    (RESEARCH_PAPER, "research paper"),
    (LOREM, "prose"),
    (JOB_DESCRIPTION, "job description"),
])
def test_other_documents_are_rejected(text, label):
    r = assess(normalise_text(text))
    assert r.verdict == "not_resume", f"{label} scored {r.score}"


def test_rejection_names_what_it_looks_like():
    with pytest.raises(NotAResumeError) as e:
        require_resume(normalise_text(INVOICE))
    assert "invoice" in e.value.message and e.value.code == "NOT_A_RESUME" and e.value.status_code == 422


def test_plain_word_be_is_not_a_degree():
    r = assess("The payment must be quoted. It will be paid. Things to be done.")
    assert r.signals["degree"] is False


def test_phone_formats():
    for number in ("+91 98765 43210", "9876543210", "(415) 555-0172", "415-555-0172"):
        assert assess(f"Jane Doe\n{number}\njane@x.com").signals["phone"], number
    assert assess("Total due 10,856 rupees").signals["phone"] is False
