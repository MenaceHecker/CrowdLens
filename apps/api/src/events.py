from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, Optional, Tuple
from uuid import uuid4

from packages.shared.models import Event, LatLng, Report


def _cell_id(lat: float, lng: float, cell_size_deg: float = 0.01) -> str:
    lat_bucket = int(lat / cell_size_deg)
    lng_bucket = int(lng / cell_size_deg)
    return f"{lat_bucket}:{lng_bucket}"


def _centroid(reports: list[Report]) -> LatLng:
    lat = sum(r.location.lat for r in reports) / max(len(reports), 1)
    lng = sum(r.location.lng for r in reports) / max(len(reports), 1)
    return LatLng(lat=lat, lng=lng)


def _derive_trend(report_count: int) -> str:
    if report_count <= 1:
        return "new"
    if report_count <= 3:
        return "growing"
    return "stable"


def _minutes_since(dt: datetime, now: datetime) -> int:
    delta = now - dt
    return max(0, int(delta.total_seconds() // 60))


def _is_recent(minutes_since_last_report: int) -> bool:
    return minutes_since_last_report <= 30


def _report_velocity_per_hour(first_seen_at: datetime, last_seen_at: datetime, report_count: int) -> float:
    elapsed_seconds = max((last_seen_at - first_seen_at).total_seconds(), 60.0)
    elapsed_hours = elapsed_seconds / 3600.0
    velocity = report_count / elapsed_hours
    return round(velocity, 2)


def _refresh_metrics(event: Event, now: datetime) -> None:
    event.minutes_since_last_report = _minutes_since(event.last_seen_at, now)
    event.is_recent = _is_recent(event.minutes_since_last_report)
    event.report_velocity_per_hour = _report_velocity_per_hour(
        event.first_seen_at,
        event.last_seen_at,
        event.report_count,
    )


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
            if report.id not in event.report_ids:
                event.report_ids.append(report.id)

            event.report_count = len(event.report_ids)
            event.updated_at = now
            event.last_seen_at = now
            event.trend = _derive_trend(event.report_count)

            if event.report_count >= 3:
                event.status = "active"

            linked = [all_reports[rid] for rid in event.report_ids if rid in all_reports]
            event.centroid = _centroid(linked) if linked else event.centroid

            _refresh_metrics(event, now)

            self.events[event.id] = event
            return event, False

        eid = str(uuid4())
        event = Event(
            id=eid,
            status="forming",
            created_at=now,
            updated_at=now,
            first_seen_at=now,
            last_seen_at=now,
            trend="new",
            minutes_since_last_report=0,
            is_recent=True,
            report_velocity_per_hour=1.0,
            cell_id=cell,
            centroid=LatLng(lat=report.location.lat, lng=report.location.lng),
            report_ids=[report.id],
            report_count=1,
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
        items = [event for event in self.events.values() if event.status in ("forming", "active")]
        for event in items:
            _refresh_metrics(event, now)
        items.sort(key=lambda event: event.updated_at, reverse=True)
        return items