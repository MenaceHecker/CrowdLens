from pydantic import BaseModel, Field
from typing import Any, Optional, Literal, Dict
from datetime import datetime

ReportStatus = Literal["submitted", "queued", "processing", "ready", "failed"]

JobType = Literal["report_created"]
JobStatus = Literal["queued", "processing", "done", "failed"]

class LatLng(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)

class CreateReportRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=4000)
    location: LatLng
    occurred_at: Optional[datetime] = None
    media_url: Optional[str] = None  #Cloud Storage URL or placeholder

class Report(BaseModel):
    id: str
    user_id: str
    text: str
    location: LatLng
    occurred_at: Optional[datetime] = None
    created_at: datetime
    status: ReportStatus = "submitted"
    media_url: Optional[str] = None

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