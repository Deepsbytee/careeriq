"""Safe upload parsing: validate the file, extract clean text, reject junk.

Everything here raises ``DocumentError`` with a message that can be shown to
the user directly. Nothing is guessed: a file that can't be read as a real,
text-based document is rejected instead of being "analysed" as garbage.
"""
from __future__ import annotations

import hashlib
import io
import re
import zipfile
from dataclasses import dataclass

from app.core.config import settings
from app.core.errors import DocumentError

ALLOWED_EXTENSIONS = (".pdf", ".docx", ".txt")
MIN_WORDS = 80          # below this there's nothing meaningful to analyse
SCANNED_WORDS = 25      # below this a PDF is almost certainly just images
MIN_READABLE_RATIO = 0.88

_LIGATURES = {"\ufb01": "fi", "\ufb02": "fl", "\ufb00": "ff", "\ufb03": "ffi", "\ufb04": "ffl"}
_LEADING_BULLET = re.compile(r"^\s*(?:[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]+|[\u00b7\u25aa\u25ab\u25c6\u25c7\u2713\u2714\u00bb\u2043\u25cf\u25cb])\s*")
_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]")
_BULLET_GLYPHS = "•●▪■◦○➢➤►▶‣⁃∙·–—\uf0b7\uf0a7\uf076\uf0d8"


@dataclass
class ParsedDocument:
    text: str
    file_type: str          # pdf | docx | txt
    pages: int | None
    word_count: int
    text_hash: str


# ── Public API ───────────────────────────────────────────────
def parse_upload(filename: str | None, content: bytes) -> ParsedDocument:
    name = (filename or "").strip().lower()
    _check_size(content)
    ext = _check_extension(name)
    _check_magic(ext, content)

    pages: int | None = None
    if ext == ".pdf":
        raw, pages = _extract_pdf(content)
    elif ext == ".docx":
        raw = _extract_docx(content)
    else:
        raw = _extract_txt(content)

    text = normalise_text(raw)
    _check_quality(text, ext, pages)
    words = len(text.split())
    return ParsedDocument(
        text=text,
        file_type=ext.lstrip("."),
        pages=pages,
        word_count=words,
        text_hash=hashlib.sha256(text.lower().encode("utf-8")).hexdigest(),
    )


def normalise_text(raw: str) -> str:
    text = raw.replace("\x00", " ").replace("\xa0", " ").replace("\u200b", "")
    for k, v in _LIGATURES.items():
        text = text.replace(k, v)
    # Private-use bullet glyphs from Word/PDF fonts -> a plain bullet.
    text = re.sub("[\uf000-\uf8ff]", "•", text)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    # "exper-\nience" -> "experience" (only lowercase-to-lowercase joins).
    text = re.sub(r"([a-z])-\n([a-z])", r"\1\2", text)
    lines = []
    for ln in text.split("\n"):
        # PDFs encode bullets many ways: control characters (e.g. DEL), middle dots, check marks...
        ln = _LEADING_BULLET.sub("\u2022 ", ln)
        ln = _CONTROL_CHARS.sub(" ", ln)
        lines.append(re.sub(r"[ \t]+", " ", ln).strip())
    text = "\n".join(lines)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


# ── Checks ───────────────────────────────────────────────────
def _check_size(content: bytes) -> None:
    if not content:
        raise DocumentError("That file is empty. Upload your resume as a PDF, DOCX, or TXT file.", code="EMPTY_FILE")
    if len(content) > settings.max_upload_bytes:
        raise DocumentError(
            f"That file is larger than {settings.MAX_UPLOAD_MB} MB. Export a smaller version and try again.",
            code="FILE_TOO_LARGE",
            status_code=413,
        )


def _check_extension(name: str) -> str:
    for ext in ALLOWED_EXTENSIONS:
        if name.endswith(ext):
            return ext
    if name.endswith(".doc"):
        raise DocumentError(
            "Old .doc files aren't supported. Save your resume as .docx or PDF and upload it again.",
            code="UNSUPPORTED_TYPE",
            status_code=415,
        )
    raise DocumentError(
        "Upload your resume as a PDF, DOCX, or TXT file.", code="UNSUPPORTED_TYPE", status_code=415
    )


def _check_magic(ext: str, content: bytes) -> None:
    """The extension is only a claim. Check the bytes actually match it."""
    if ext == ".pdf":
        if b"%PDF-" not in content[:1024]:
            raise DocumentError("That file isn't a valid PDF. Export your resume as a PDF and try again.", code="CORRUPT_FILE")
    elif ext == ".docx":
        ok = False
        if zipfile.is_zipfile(io.BytesIO(content)):
            try:
                with zipfile.ZipFile(io.BytesIO(content)) as z:
                    ok = "word/document.xml" in z.namelist()
            except zipfile.BadZipFile:
                ok = False
        if not ok:
            raise DocumentError("That file isn't a valid Word document. Re-save it as .docx and try again.", code="CORRUPT_FILE")
    else:  # .txt
        if b"\x00" in content[:4096]:
            raise DocumentError("That file looks like binary data, not text. Upload a PDF, DOCX, or TXT resume.", code="CORRUPT_FILE")


def _check_quality(text: str, ext: str, pages: int | None) -> None:
    words = len(text.split())
    if ext == ".pdf" and words < SCANNED_WORDS:
        raise DocumentError(
            "This PDF has no readable text. It's probably a scan or a photo. "
            "Export your resume as a text-based PDF from Word or Google Docs and try again.",
            code="NO_TEXT",
        )
    if words < MIN_WORDS:
        raise DocumentError(
            f"This document only has {words} words, which is too short to analyse. "
            "A resume usually has at least 150.",
            code="TOO_SHORT",
        )
    if words > settings.MAX_RESUME_WORDS:
        raise DocumentError(
            f"This document has {words:,} words, which is far more than a resume. "
            "Upload just your resume.",
            code="TOO_LONG",
        )
    readable = sum(ch.isalnum() or ch.isspace() or ch in ".,;:()-/&+%@#'\"|•_$" for ch in text)
    if readable / max(len(text), 1) < MIN_READABLE_RATIO:
        raise DocumentError(
            "The text in this file is garbled, usually because of a custom font or encoding. "
            "Re-export it as a PDF from Word or Google Docs and try again.",
            code="GARBLED_TEXT",
        )


# ── Extractors ───────────────────────────────────────────────
def _extract_pdf(content: bytes) -> tuple[str, int]:
    from pypdf import PdfReader
    from pypdf.errors import PdfReadError

    try:
        reader = PdfReader(io.BytesIO(content))
        if reader.is_encrypted:
            try:
                if not reader.decrypt(""):
                    raise DocumentError(
                        "This PDF is password-protected. Remove the password and upload it again.",
                        code="PASSWORD_PROTECTED",
                    )
            except DocumentError:
                raise
            except Exception:
                raise DocumentError(
                    "This PDF is password-protected. Remove the password and upload it again.",
                    code="PASSWORD_PROTECTED",
                )
        n_pages = len(reader.pages)
        if n_pages > settings.MAX_RESUME_PAGES:
            raise DocumentError(
                f"This PDF has {n_pages} pages. A resume is usually 1–2, so this doesn't look like one. "
                "Upload only your resume.",
                code="TOO_MANY_PAGES",
            )
        parts = [(p.extract_text() or "") for p in reader.pages]
        return "\n".join(parts), n_pages
    except DocumentError:
        raise
    except (PdfReadError, ValueError, KeyError, OSError, AttributeError, TypeError):
        raise DocumentError("We couldn't read that PDF. It may be damaged. Export it again and retry.", code="CORRUPT_FILE")


def _extract_docx(content: bytes) -> str:
    import docx

    try:
        d = docx.Document(io.BytesIO(content))
    except Exception:
        raise DocumentError("We couldn't read that Word document. Re-save it as .docx and retry.", code="CORRUPT_FILE")

    lines: list[str] = []
    for section in d.sections:  # headers often hold the name and contact line
        for p in section.header.paragraphs:
            if p.text.strip():
                lines.append(p.text)
    # Body paragraphs and tables, in document order.
    body = d.element.body
    for child in body.iterchildren():
        tag = child.tag.rsplit("}", 1)[-1]
        if tag == "p":
            lines.append("".join(t.text or "" for t in child.iter() if t.tag.endswith("}t")))
        elif tag == "tbl":
            for row in child.iter():
                if row.tag.endswith("}tr"):
                    seen: list[str] = []
                    for cell in row.iterchildren():
                        if not cell.tag.endswith("}tc"):
                            continue
                        txt = " ".join(
                            "".join(t.text or "" for t in p.iter() if t.tag.endswith("}t"))
                            for p in cell.iter()
                            if p.tag.endswith("}p")
                        ).strip()
                        if txt and txt not in seen:  # merged cells repeat their text
                            seen.append(txt)
                    if seen:
                        lines.append("  ".join(seen))
    return "\n".join(lines)


def _extract_txt(content: bytes) -> str:
    for enc in ("utf-8-sig", "utf-16", "latin-1"):
        try:
            return content.decode(enc)
        except (UnicodeDecodeError, UnicodeError):
            continue
    return content.decode("utf-8", errors="ignore")


# ── Pasted text (job descriptions) ───────────────────────────
_JD_HINTS = (
    "responsibilit", "requirement", "qualification", "experience", "skills", "role",
    "you will", "we are looking", "we're looking", "about the", "apply", "candidate",
    "job", "position", "team", "preferred", "must have", "nice to have", "benefits",
)


def validate_job_description(text: str) -> str:
    text = normalise_text(text or "")
    words = len(text.split())
    if words < 30:
        raise DocumentError(
            f"That job description is only {words} words. Paste the full posting, including requirements.",
            code="JD_TOO_SHORT",
        )
    if words > 3000:
        raise DocumentError("That job description is very long. Paste only the posting itself.", code="JD_TOO_LONG")
    low = text.lower()
    hits = sum(1 for h in _JD_HINTS if h in low)
    if hits < 3:
        raise DocumentError(
            "That doesn't look like a job description. Paste the responsibilities and requirements from the posting.",
            code="NOT_A_JOB_DESCRIPTION",
        )
    return text
