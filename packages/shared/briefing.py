from typing import List, Literal

from pydantic import BaseModel, Field


SeverityLevel = Literal["low", "medium", "high", "critical"]


class BriefingSourceStats(BaseModel):
    report_count: int = Field(..., ge=0)
    has_media: bool = False


class EventBriefing(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)
    summary: str = Field(..., min_length=1, max_length=1000)
    severity: SeverityLevel
    confidence: float = Field(..., ge=0.0, le=1.0)
    recommended_actions: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    source_stats: BriefingSourceStats