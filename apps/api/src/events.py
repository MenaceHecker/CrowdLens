from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, Optional, Tuple
from uuid import uuid4

from packages.shared.models import Event, LatLng, Report


COOLING_DOWN_AFTER_MINUTES = 30
RESOLVED_AFTER_MINUTES = 120


def _cell_id(lat: float, lng: float, cell_size_deg: float = 0.01) -> str:
    lat_bucket = int(lat / cell_size_deg)
    lng_bucket = int(lng / cell_size_deg)
    return f"{lat_bucket}:{lng_bucket}"


def _centroid(reports: list[Report]) -> LatLng:
    lat = sum(r.location.lat for r in reports) / max(len(reports), 1)
    lng = sum(r.location.lng for r in reports) / max(len(reports), 1)
    return LatLng(lat=lat, lng=lng)


def _derive_trend(unique_report_count: int) -> str:
    if unique_report_count <= 1:
        return "new"
    if unique_report_count <= 3:
        return "growing"
    return "stable"


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


def _find_duplicate_report(event: Event, candidate: Report, all_reports: Dict[str, Report]) -> Optional[str]:
    for report_id in reversed(event.report_ids):
        existing = all_reports.get(report_id)
        if not existing:
            continue

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


def _refresh_metrics(event: Event, now: datetime) -> None:
    event.minutes_since_last_report = _minutes_since(event.last_seen_at, now)
    event.is_recent = _is_recent(event.minutes_since_last_report)
    event.report_velocity_per_hour = _report_velocity_per_hour(
        event.first_seen_at,
        event.last_seen_at,
        max(event.unique_report_count, 1),
    )
    _apply_lifecycle(event, now)
    event.ranking_score = _ranking_score(event)


@dataclass
class InMemoryEventStore:
    events: Dict[str, Event]
    cell_to_event: Dict[str, str]

    def __init__(self) -> None:
        self.events = {}
        self.cell_to_event = {}

    def upsert_from_report(self, report: Report, all_reports: Dict[str, Report]) -> Tuple[Event, bool]:
        now = datetime.now(timezone.utc)
        cell = _cell_id(report.location.lat, report.location.lng)

        existing_event_id = self.cell_to_event.get(cell)
        if existing_event_id and existing_event_id in self.events:
            event = self.events[existing_event_id]

            duplicate_of = _find_duplicate_report(event, report, all_reports)
            if duplicate_of:
                report.is_duplicate = True
                report.duplicate_of = duplicate_of
            else:
                report.is_duplicate = False
                report.duplicate_of = None

            if report.id not in event.report_ids:
                event.report_ids.append(report.id)

            event.report_count = len(event.report_ids)
            event.unique_report_count = len(
                [rid for rid in event.report_ids if rid in all_reports and not all_reports[rid].is_duplicate]
            )
            event.duplicate_report_count = event.report_count - event.unique_report_count

            event.updated_at = now
            event.last_seen_at = now
            event.trend = _derive_trend(event.unique_report_count)

            unique_reports = [
                all_reports[rid]
                for rid in event.report_ids
                if rid in all_reports and not all_reports[rid].is_duplicate
            ]
            event.centroid = _centroid(unique_reports) if unique_reports else event.centroid

            _refresh_metrics(event, now)

            self.events[event.id] = event
            return event, False

        eid = str(uuid4())
        report.is_duplicate = False
        report.duplicate_of = None

        event = Event(
            id=eid,
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
            cell_id=cell,
            centroid=LatLng(lat=report.location.lat, lng=report.location.lng),
            report_ids=[report.id],
            report_count=1,
            unique_report_count=1,
            duplicate_report_count=0,
            confidence=0.5,
            severity=1,
            title="Situation forming",
            briefing=None,
        )

        _refresh_metrics(event, now)

        self.events[eid] = event
        self.cell_to_event[cell] = eid
        return event, True

    def get(self, event_id: str) -> Optional[Event]:
        event = self.events.get(event_id)
        if event:
            _refresh_metrics(event, datetime.now(timezone.utc))
        return event

    def list_active(self) -> list[Event]:
        now = datetime.now(timezone.utc)
        items = [
            event
            for event in self.events.values()
            if event.status in ("forming", "active", "cooling_down", "resolved")
        ]
        for event in items:
            _refresh_metrics(event, now)

        items.sort(
            key=lambda event: (
                event.ranking_score,
                event.updated_at,
            ),
            reverse=True,
        )
        return items