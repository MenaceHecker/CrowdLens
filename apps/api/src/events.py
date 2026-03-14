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

            if event.report_count >= 3:
                event.status = "active"

            linked = [all_reports[rid] for rid in event.report_ids if rid in all_reports]
            event.centroid = _centroid(linked) if linked else event.centroid

            self.events[event.id] = event
            return event, False

        eid = str(uuid4())
        event = Event(
            id=eid,
            status="forming",
            created_at=now,
            updated_at=now,
            cell_id=cell,
            centroid=LatLng(lat=report.location.lat, lng=report.location.lng),
            report_ids=[report.id],
            report_count=1,
            confidence=0.5,
            severity=1,
            title="Situation forming",
            briefing=None,
        )
        self.events[eid] = event
        self.cell_to_event[cell] = eid
        return event, True

    def get(self, event_id: str) -> Optional[Event]:
        return self.events.get(event_id)

    def list_active(self) -> list[Event]:
        items = [event for event in self.events.values() if event.status in ("forming", "active")]
        items.sort(key=lambda event: event.updated_at, reverse=True)
        return items