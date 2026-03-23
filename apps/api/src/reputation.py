from datetime import datetime, timezone

from packages.core.config import settings
from packages.shared.models import Report, UserProfile


def clamp_score(value: float) -> float:
    return max(0.0, min(1.0, round(value, 2)))


def apply_low_quality_rejection(profile: UserProfile) -> UserProfile:
    profile.low_quality_rejections += 1
    profile.reputation_score = clamp_score(
        profile.reputation_score - settings.USER_REPUTATION_PENALTY_LOW_QUALITY
    )
    profile.updated_at = datetime.now(timezone.utc)
    return profile


def apply_report_submission(profile: UserProfile, report: Report) -> UserProfile:
    profile.total_reports += 1
    profile.last_report_at = report.created_at
    profile.updated_at = datetime.now(timezone.utc)

    if report.is_duplicate:
        profile.duplicate_reports += 1
        profile.reputation_score = clamp_score(
            profile.reputation_score - settings.USER_REPUTATION_PENALTY_DUPLICATE
        )
    else:
        profile.unique_reports += 1
        profile.reputation_score = clamp_score(
            profile.reputation_score + settings.USER_REPUTATION_BONUS_UNIQUE
        )

    return profile