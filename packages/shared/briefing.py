from typing import Literal, List

from pydantic import BaseModel, Field


SeverityLevel = Literal["low", "medium", "high", "critical"]


class BriefingSourceStats(BaseModel):
    report_count: int = Field(default=0, ge=0)
    has_media: bool = False


class EventBriefing(BaseModel):
    title: str
    summary: str
    incident_type: str = "unknown"
    severity: SeverityLevel
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    recommended_actions: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    source_stats: BriefingSourceStats