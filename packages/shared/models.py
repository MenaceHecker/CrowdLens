from datetime import datetime
from typing import Optional, Literal, Any, Dict, List

from pydantic import BaseModel, Field

from packages.shared.briefing import EventBriefing


ReportStatus = Literal["submitted", "queued", "processing", "ready", "failed"]
JobType = Literal["report_created"]
JobStatus = Literal["queued", "processing", "done", "failed"]
EventStatus = Literal["forming", "active", "cooling_down", "resolved"]
EventTrend = Literal["new", "growing", "stable"]


class LatLng(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)


class CreateReportRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=4000)
    location: LatLng
    occurred_at: Optional[datetime] = None
    media_url: Optional[str] = None
    media_path: Optional[str] = None


class CreateUploadUrlRequest(BaseModel):
    filename: str = Field(..., min_length=1, max_length=255)
    content_type: str = Field(..., min_length=1, max_length=255)


class CreateUploadUrlResponse(BaseModel):
    object_path: str
    upload_url: str
    content_type: str


class Report(BaseModel):
    id: str
    user_id: str
    text: str
    location: LatLng
    occurred_at: Optional[datetime] = None
    created_at: datetime
    status: ReportStatus = "submitted"
    media_url: Optional[str] = None

    is_duplicate: bool = False
    duplicate_of: Optional[str] = None
    trust_score: float = Field(default=0.6, ge=0.0, le=1.0)


class JobPayload(BaseModel):
    report_id: str
    user_id: str


class Job(BaseModel):
    id: str
    type: JobType
    status: JobStatus
    payload: JobPayload
    created_at: datetime
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    error: Optional[str] = None


class NextJobRequest(BaseModel):
    worker_id: str = Field(..., min_length=1, max_length=64)


class JobResultRequest(BaseModel):
    worker_id: str = Field(..., min_length=1, max_length=64)
    ok: bool = True
    error: Optional[str] = None
    output: Optional[Dict[str, Any]] = None


class Event(BaseModel):
    id: str
    status: EventStatus
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None

    first_seen_at: datetime
    last_seen_at: datetime
    trend: EventTrend = "new"

    minutes_since_last_report: int = 0
    is_recent: bool = True
    report_velocity_per_hour: float = 0.0
    ranking_score: float = 0.0

    cell_id: str
    centroid: LatLng

    report_ids: List[str] = Field(default_factory=list)
    report_count: int = 0
    unique_report_count: int = 0
    duplicate_report_count: int = 0

    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    severity: int = Field(default=1, ge=1, le=5)
    title: str = "Situation forming"
    briefing: Optional[EventBriefing] = None


class FeedItem(BaseModel):
    event: Event
    latest_report_id: Optional[str] = None