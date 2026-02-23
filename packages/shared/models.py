from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime

ReportStatus = Literal["submitted", "queued", "processing", "ready", "failed"]

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
