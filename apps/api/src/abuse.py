from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import HTTPException

from packages.core.config import settings
from packages.shared.models import Report


def normalize_report_text(text: str) -> str:
    return " ".join(text.lower().strip().split())


def is_low_signal_text(text: str) -> bool:
    normalized = normalize_report_text(text)

    if len(normalized) < settings.REPORT_MIN_TEXT_LENGTH:
        return True

    blocked_exact = {
        "test",
        "testing",
        "hello",
        "hi",
        "aaa",
        "aaaa",
        "aaaaa",
        "12345678",
        ".........",
    }
    if normalized in blocked_exact:
        return True

    unique_chars = set(normalized.replace(" ", ""))
    if len(unique_chars) <= 2 and len(normalized) >= settings.REPORT_MIN_TEXT_LENGTH:
        return True

    return False


def enforce_report_text_quality(text: str) -> None:
    if is_low_signal_text(text):
        raise HTTPException(
            status_code=400,
            detail="low_quality_report_text",
        )


def find_recent_duplicate_text(
    candidate_text: str,
    recent_reports: List[Report],
    now: Optional[datetime] = None,
) -> Optional[Report]:
    now = now or datetime.now(timezone.utc)
    normalized_candidate = normalize_report_text(candidate_text)
    window_start = now - timedelta(minutes=settings.REPORT_DUPLICATE_WINDOW_MINUTES)

    for report in recent_reports:
        if report.created_at < window_start:
            continue

        if normalize_report_text(report.text) == normalized_candidate:
            return report

    return None


def enforce_submission_cooldown(
    recent_reports: List[Report],
    now: Optional[datetime] = None,
) -> None:
    now = now or datetime.now(timezone.utc)

    if not recent_reports:
        return

    latest = recent_reports[0]
    elapsed = (now - latest.created_at).total_seconds()

    if elapsed < settings.REPORT_SUBMISSION_COOLDOWN_SECONDS:
        remaining = int(settings.REPORT_SUBMISSION_COOLDOWN_SECONDS - elapsed)
        raise HTTPException(
            status_code=429,
            detail=f"report_cooldown_active:{remaining}s",
        )


def enforce_duplicate_submission_rule(
    candidate_text: str,
    recent_reports: List[Report],
    now: Optional[datetime] = None,
) -> None:
    duplicate = find_recent_duplicate_text(candidate_text, recent_reports, now=now)
    if duplicate:
        raise HTTPException(
            status_code=409,
            detail=f"duplicate_report_text:{duplicate.id}",
        )