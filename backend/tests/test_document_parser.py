import pytest
from conftest import make_docx, make_pdf, make_scanned_pdf
from samples import INVOICE, JOB_DESCRIPTION, STRONG_RESUME

from app.core.config import settings
from app.core.errors import DocumentError
from app.services.document_parser import normalise_text, parse_upload, validate_job_description


def code_of(fn, *a):
    with pytest.raises(DocumentError) as e:
        fn(*a)
    return e.value.code


def test_valid_pdf_is_parsed(strong_pdf):
    doc = parse_upload("Priya Resume.PDF", strong_pdf)
    assert doc.file_type == "pdf" and doc.pages == 1
    assert doc.word_count > 150
    assert "FastAPI" in doc.text and "priya.sharma@example.com" in doc.text
    assert len(doc.text_hash) == 64


def test_same_text_gives_same_hash(strong_pdf):
    assert parse_upload("a.pdf", strong_pdf).text_hash == parse_upload("b.pdf", strong_pdf).text_hash


def test_empty_file():
    assert code_of(parse_upload, "a.pdf", b"") == "EMPTY_FILE"


def test_oversized_file(monkeypatch):
    monkeypatch.setattr(settings, "MAX_UPLOAD_MB", 1)
    with pytest.raises(DocumentError) as e:
        parse_upload("a.pdf", b"%PDF-" + b"x" * (1024 * 1024 + 10))
    assert e.value.code == "FILE_TOO_LARGE" and e.value.status_code == 413


def test_unsupported_types():
    assert code_of(parse_upload, "photo.png", b"\x89PNG....") == "UNSUPPORTED_TYPE"
    assert code_of(parse_upload, "old.doc", b"\xd0\xcf\x11\xe0") == "UNSUPPORTED_TYPE"
    assert code_of(parse_upload, None, b"abc") == "UNSUPPORTED_TYPE"


def test_text_file_renamed_to_pdf_is_rejected():
    assert code_of(parse_upload, "resume.pdf", STRONG_RESUME.encode()) == "CORRUPT_FILE"


def test_random_zip_renamed_to_docx_is_rejected():
    import io
    import zipfile
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("hello.txt", "hi")
    assert code_of(parse_upload, "resume.docx", buf.getvalue()) == "CORRUPT_FILE"


def test_binary_txt_is_rejected():
    assert code_of(parse_upload, "resume.txt", b"abc\x00\x01\x02" * 50) == "CORRUPT_FILE"


def test_scanned_pdf_gets_a_helpful_error():
    assert code_of(parse_upload, "scan.pdf", make_scanned_pdf()) == "NO_TEXT"


def test_too_many_pages():
    assert code_of(parse_upload, "book.pdf", make_pdf(STRONG_RESUME, pages_min=9)) == "TOO_MANY_PAGES"


def test_password_protected_pdf():
    assert code_of(parse_upload, "locked.pdf", make_pdf(STRONG_RESUME, encrypt="secret")) == "PASSWORD_PROTECTED"


def test_too_short_document():
    assert code_of(parse_upload, "tiny.txt", b"Just a few words here, not a resume at all.") == "TOO_SHORT"


def test_too_long_document(monkeypatch):
    monkeypatch.setattr(settings, "MAX_RESUME_WORDS", 200)
    assert code_of(parse_upload, "long.txt", (STRONG_RESUME * 3).encode()) == "TOO_LONG"


def test_garbled_text():
    junk = ("\u0394\u03a3\u03a9\u2234\u221e\u2248\u2260\u2261\u2264\u2265 " * 120).encode("utf-8")
    assert code_of(parse_upload, "junk.txt", junk) == "GARBLED_TEXT"


def test_docx_text_and_tables_are_both_read():
    data = make_docx(
        ["Priya Sharma", "priya@example.com"] + ["Built things with FastAPI and React for many users."] * 12,
        table_rows=[["Skills", "Python, Docker, PostgreSQL"], ["Education", "B.E. Computer Science"]],
    )
    doc = parse_upload("r.docx", data)
    assert doc.file_type == "docx" and doc.pages is None
    assert "Python, Docker, PostgreSQL" in doc.text and "B.E. Computer Science" in doc.text


def test_txt_utf8_and_latin1():
    body = "Experience " + "résumé skills python " * 40
    assert "résumé" in parse_upload("a.txt", body.encode("utf-8")).text
    assert "résumé" in parse_upload("a.txt", body.encode("latin-1")).text


def test_normalise_text():
    raw = "Exper-\nience\u00a0at  \ufb01rst\r\n\r\n\r\n\r\nNext \uf0b7 item\x00"
    out = normalise_text(raw)
    assert "Experience at first" in out
    assert "\n\n\n" not in out and "\x00" not in out and "\u2022 item" in out


def test_job_description_validation():
    assert "Backend Engineer" in validate_job_description(JOB_DESCRIPTION)
    assert code_of(validate_job_description, "Python developer wanted") == "JD_TOO_SHORT"
    assert code_of(validate_job_description, INVOICE) == "NOT_A_JOB_DESCRIPTION"
