from datetime import datetime, timezone
from typing import List, Optional, Tuple
from uuid import uuid4
from statistics import mean
from packages.shared.models import Event, Report

from packages.shared.models import Event, LatLng, Report


COOLING_DOWN_AFTER_MINUTES = 30
RESOLVED_AFTER_MINUTES = 120


def compute_cell_id(lat: float, lng: float, cell_size_deg: float = 0.01) -> str:
    lat_bucket = int(lat / cell_size_deg)
    lng_bucket = int(lng / cell_size_deg)
    return f"{lat_bucket}:{lng_bucket}"


def _centroid(reports: List[Report]) -> LatLng:
    lat = sum(r.location.lat for r in reports) / max(len(reports), 1)
    lng = sum(r.location.lng for r in reports) / max(len(reports), 1)
    return LatLng(lat=lat, lng=lng)


def _derive_trend(unique_report_count: int) -> str:
    if unique_report_count <= 1:
        return "new"
    if unique_report_count <= 3:
        return "growing"
    return "stable"

def _derive_surge_status(
    unique_report_count: int,
    minutes_since_last_report: int,
    report_velocity_per_hour: float,
    has_media: bool,
) -> tuple[str, float]:
    score = (
        report_velocity_per_hour * 0.6 +
        unique_report_count * 0.5 +
        (2.0 if has_media else 0.0)
    )

    if minutes_since_last_report > 180:
        return "cooling", round(score, 2)

    if score >= 8:
        return "surging", round(score, 2)

    return "stable", round(score, 2)


def _minutes_since(dt: datetime, now: datetime) -> int:
    delta = now - dt
    return max(0, int(delta.total_seconds() // 60))


def _is_recent(minutes_since_last_report: int) -> bool:
    return minutes_since_last_report <= 30


def _report_velocity_per_hour(first_seen_at: datetime, last_seen_at: datetime, unique_report_count: int) -> float:
    elapsed_seconds = max((last_seen_at - first_seen_at).total_seconds(), 60.0)
    elapsed_hours = elapsed_seconds / 3600.0
    velocity = unique_report_count / elapsed_hours
    return round(velocity, 2)


def _normalize_text(text: str) -> str:
    return " ".join(text.lower().strip().split())


def _token_similarity(a: str, b: str) -> float:
    a_tokens = set(_normalize_text(a).split())
    b_tokens = set(_normalize_text(b).split())

    if not a_tokens or not b_tokens:
        return 0.0

    overlap = len(a_tokens & b_tokens)
    union = len(a_tokens | b_tokens)
    return overlap / union


def _within_duplicate_window(a: datetime, b: datetime, minutes: int = 15) -> bool:
    delta_seconds = abs((a - b).total_seconds())
    return delta_seconds <= minutes * 60


def _find_duplicate_report(existing_reports: List[Report], candidate: Report) -> Optional[str]:
    ordered = sorted(existing_reports, key=lambda report: report.created_at, reverse=True)

    for existing in ordered:
        if existing.is_duplicate:
            continue

        if not _within_duplicate_window(existing.created_at, candidate.created_at):
            continue

        similarity = _token_similarity(existing.text, candidate.text)
        if similarity >= 0.6:
            return existing.id

    return None


def _apply_lifecycle(event: Event, now: datetime) -> None:
    minutes_stale = _minutes_since(event.last_seen_at, now)

    if minutes_stale >= RESOLVED_AFTER_MINUTES:
        event.status = "resolved"
        if event.resolved_at is None:
            event.resolved_at = now
    elif minutes_stale >= COOLING_DOWN_AFTER_MINUTES:
        if event.status != "resolved":
            event.status = "cooling_down"
            event.resolved_at = None
    else:
        if event.unique_report_count >= 3:
            event.status = "active"
        else:
            event.status = "forming"
        event.resolved_at = None


def _ranking_score(event: Event) -> float:
    severity_component = event.severity * 20.0
    confidence_component = event.confidence * 30.0
    recency_component = max(0.0, 25.0 - min(event.minutes_since_last_report, 25))
    velocity_component = min(event.report_velocity_per_hour, 20.0) * 1.5

    has_media = bool(event.briefing and getattr(event.briefing, "source_stats", None) and event.briefing.source_stats.get("has_media"))
    event.surge_status, event.surge_score = _derive_surge_status(
    unique_report_count=event.unique_report_count,
    minutes_since_last_report=event.minutes_since_last_report,
    report_velocity_per_hour=event.report_velocity_per_hour,
    has_media=has_media,)

    trend_bonus_map = {
        "new": 4.0,
        "growing": 10.0,
        "stable": 6.0,
    }
    trend_component = trend_bonus_map.get(event.trend, 0.0)

    status_bonus_map = {
        "forming": 0.0,
        "active": 5.0,
        "cooling_down": -8.0,
        "resolved": -25.0,
    }
    status_component = status_bonus_map.get(event.status, 0.0)

    duplicate_penalty = min(event.duplicate_report_count * 2.0, 10.0)

    total = (
        severity_component
        + confidence_component
        + recency_component
        + velocity_component
        + trend_component
        + status_component
        - duplicate_penalty
    )
    return round(max(total, 0.0), 2)



def refresh_event_metrics(event: Event, now: Optional[datetime] = None) -> Event:
    now = now or datetime.now(timezone.utc)

    event.minutes_since_last_report = _minutes_since(event.last_seen_at, now)
    event.is_recent = _is_recent(event.minutes_since_last_report)
    event.report_velocity_per_hour = _report_velocity_per_hour(
        event.first_seen_at,
        event.last_seen_at,
        max(event.unique_report_count, 1),
    )
    _apply_lifecycle(event, now)
    event.ranking_score = _ranking_score(event)
    return event


def upsert_event_from_report(
    existing_event: Optional[Event],
    report: Report,
    existing_reports: List[Report],
) -> Tuple[Event, bool]:
    now = datetime.now(timezone.utc)

    if existing_event is None:
        report.is_duplicate = False
        report.duplicate_of = None

        event = Event(
            id=str(uuid4()),
            status="forming",
            created_at=now,
            updated_at=now,
            resolved_at=None,
            first_seen_at=now,
            last_seen_at=now,
            trend="new",
            minutes_since_last_report=0,
            is_recent=True,
            report_velocity_per_hour=1.0,
            ranking_score=0.0,
            cell_id=compute_cell_id(report.location.lat, report.location.lng),
            centroid=LatLng(lat=report.location.lat, lng=report.location.lng),
            report_ids=[report.id],
            report_count=1,
            unique_report_count=1,
            duplicate_report_count=0,
            confidence=0.5,
            severity=1,
            title="Situation forming",
            briefing=None,
            surge_status="stable",
            surge_score=0.0,
        )
        refresh_event_metrics(event, now)
        return event, True

    duplicate_of = _find_duplicate_report(existing_reports, report)
    if duplicate_of:
        report.is_duplicate = True
        report.duplicate_of = duplicate_of
    else:
        report.is_duplicate = False
        report.duplicate_of = None

    updated_reports = list(existing_reports)
    updated_reports.append(report)

    if report.id not in existing_event.report_ids:
        existing_event.report_ids.append(report.id)

    unique_reports = [r for r in updated_reports if not r.is_duplicate]

    existing_event.report_count = len(updated_reports)
    existing_event.unique_report_count = len(unique_reports)
    existing_event.duplicate_report_count = existing_event.report_count - existing_event.unique_report_count
    existing_event.confidence = compute_event_confidence(existing_reports)
    existing_event.updated_at = now
    existing_event.last_seen_at = now
    existing_event.trend = _derive_trend(existing_event.unique_report_count)

    if unique_reports:
        existing_event.centroid = _centroid(unique_reports)

    refresh_event_metrics(existing_event, now)
    return existing_event, False


def compute_event_confidence(reports: list[Report]) -> float:
    if not reports:
        return 0.3

    unique_reports = [r for r in reports if not r.is_duplicate]
    duplicate_reports = [r for r in reports if r.is_duplicate]

    unique_weight = sum(r.trust_score for r in unique_reports)
    duplicate_weight = sum(r.trust_score * 0.35 for r in duplicate_reports)

    base = 0.35 + min(0.45, unique_weight * 0.12) + min(0.12, duplicate_weight * 0.04)

    if len(unique_reports) >= 3:
        base += 0.05

    if any(r.media_url for r in reports):
        base += 0.05

    return max(0.3, min(0.98, round(base, 2)))
