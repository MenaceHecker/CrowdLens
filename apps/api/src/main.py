from fastapi import FastAPI
from datetime import datetime, timezone
from uuid import uuid4

from packages.shared.models import CreateReportRequest, Report

app = FastAPI(title="CrowdLens API", version="0.1.0")

# local dev store temporary
REPORTS: dict[str, Report] = {}

@app.get("/healthz")
def healthz():
    return {"ok": True, "service": "api"}

@app.post("/reports", response_model=Report)
def create_report(payload: CreateReportRequest):
    rid = str(uuid4())
    report = Report(
        id=rid,
        user_id="local-dev-user",
        text=payload.text,
        location=payload.location,
        occurred_at=payload.occurred_at,
        created_at=datetime.now(timezone.utc),
        status="submitted",
        media_url=payload.media_url,
    )
    REPORTS[rid] = report
    return report
