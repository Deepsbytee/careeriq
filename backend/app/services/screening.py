"""Recruiter screening: rank many resumes against one job description.

Rule-based on purpose: no AI cost, no quota, same answer every time, and every
point of the ranking can be explained to a candidate or a hiring manager.
"""
from __future__ import annotations

from app.core.errors import AppError, DocumentError, NotAResumeError
from app.services.document_parser import parse_upload, validate_job_description
from app.services.resume_gate import assess, not_a_resume_message
from app.services.resume_insights import guess_name
from app.services.resume_scoring import compute_deterministic, extract_skills, overall


def _fit(coverage: float | None, baseline: float) -> float:
    # With a skills-bearing posting, coverage drives the rank; baseline quality breaks ties.
    return round(baseline if coverage is None else 0.65 * coverage + 0.35 * baseline, 1)


def rank_candidates(files: list[tuple[str, bytes]], job_title: str, job_description: str) -> dict:
    jd = validate_job_description(job_description)
    jd_skills = extract_skills(jd)
    if not jd_skills:
        raise DocumentError(
            "No technical skills were recognised in that job description, so candidates can't be matched on skills. "
            "Include the required tools and technologies.",
            code="NO_SKILLS_IN_JD",
        )
    jd_low = {s.lower() for s in jd_skills}

    ranked, rejected, seen_hashes = [], [], {}
    for filename, content in files:
        try:
            doc = parse_upload(filename, content)
            gate = assess(doc.text)
            if gate.is_clear_reject:
                raise NotAResumeError(not_a_resume_message(gate.looks_like))
        except AppError as e:
            rejected.append({"filename": filename, "reason": e.message, "code": e.code})
            continue
        if doc.text_hash in seen_hashes:
            rejected.append({"filename": filename, "reason": f"Duplicate of {seen_hashes[doc.text_hash]}.", "code": "DUPLICATE"})
            continue
        seen_hashes[doc.text_hash] = filename

        det = compute_deterministic(doc.text)
        have = {s.lower() for s in det.features.skills}
        matched = [s for s in jd_skills if s.lower() in have]
        missing = [s for s in jd_skills if s.lower() not in have]
        coverage = 100 * len(matched) / len(jd_skills) if len(jd_skills) >= 3 else None
        baseline = overall(det.scores)
        flags = []
        if not det.features.has_email:
            flags.append("No email address found")
        if not (det.features.has_github or det.features.has_portfolio):
            flags.append("No GitHub or portfolio link")
        if det.features.bullets and det.features.metric_bullets / len(det.features.bullets) < 0.2:
            flags.append("Few measurable results")
        ranked.append({
            "filename": filename,
            "name": guess_name(doc.text) or filename.rsplit(".", 1)[0],
            "fit_score": _fit(coverage, baseline),
            "skill_coverage": round(100 * len(matched) / len(jd_skills)),
            "resume_quality": baseline,
            "matched_skills": matched,
            "missing_skills": missing,
            "extra_skills": [s for s in det.features.skills if s.lower() not in jd_low][:8],
            "flags": flags,
        })

    ranked.sort(key=lambda r: (-r["fit_score"], -r["skill_coverage"], r["name"]))
    for i, r in enumerate(ranked, 1):
        r["rank"] = i
    return {
        "job_title": job_title.strip(),
        "required_skills": jd_skills,
        "candidates": ranked,
        "rejected": rejected,
        "method": "Fit = 65% required-skill coverage + 35% resume quality (structure, impact, readability). Rule-based, no AI.",
    }
