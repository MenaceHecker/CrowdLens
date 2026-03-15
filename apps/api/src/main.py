import logging
import traceback
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import FastAPI, Request, HTTPException, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from packages.shared.models import (
    CreateReportRequest,
    Report,
    Job,
    NextJobRequest,
    JobResultRequest,
    FeedItem,
    Event,
)
from packages.core.config import settings
from packages.core.logging import setup_logging
from apps.api.src.job_queue import InMemoryJobQueue
from apps.api.src.events import InMemoryEventStore
from apps.api.src.briefing import build_briefing


setup_logging(service="api", level=settings.LOG_LEVEL)
logger = logging.getLogger("api")

app = FastAPI(title="CrowdLens API", version="0.1.0")

REPORTS: dict[str, Report] = {}
JOB_QUEUE = InMemoryJobQueue()
EVENTS = InMemoryEventStore()
REPORT_TO_EVENT: dict[str, str] = {}
LAST_ERROR: dict | None = None


class UpsertFromReportRequest(BaseModel):
    report_id: str = Field(..., min_length=1)


class UpsertFromReportResponse(BaseModel):
    event_id: str
    created: bool


@app.middleware("http")
async def request_logging(request: Request, call_next):
    start = datetime.now(timezone.utc)
    response = None
    try:
        response = await call_next(request)
        return response
    finally:
        duration_ms = int((datetime.now(timezone.utc) - start).total_seconds() * 1000)
        logger.info(
            "request_complete",
            extra={
                "method": request.method,
                "path": request.url.path,
                "status_code": getattr(response, "status_code", None),
                "duration_ms": duration_ms,
            },
        )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    global LAST_ERROR

    tb = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))

    LAST_ERROR = {
        "where": "unhandled_exception",
        "path": request.url.path,
        "error": str(exc),
        "traceback": tb[-8000:],
    }

    logger.exception(
        "unhandled_exception",
        extra={"path": request.url.path, "error_text": str(exc)},
    )

    if settings.APP_ENV == "local":
        return JSONResponse(
            status_code=500,
            content={"error": "internal_error", "detail": str(exc)},
        )

    return JSONResponse(status_code=500, content={"error": "internal_error"})


@app.get("/healthz")
def healthz():
    return {
        "ok": True,
        "service": "api",
        "env": settings.APP_ENV,
        "time": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/debug/last-error")
def debug_last_error():
    return LAST_ERROR or {"ok": True, "last_error": None}


@app.post("/reports", response_model=Report)
def create_report(payload: CreateReportRequest):
    rid = str(uuid4())
    user_id = "local-dev-user"

    report = Report(
        id=rid,
        user_id=user_id,
        text=payload.text,
        location=payload.location,
        occurred_at=payload.occurred_at,
        created_at=datetime.now(timezone.utc),
        status="queued",
        media_url=payload.media_url,
    )
    REPORTS[rid] = report

    job = JOB_QUEUE.enqueue_report_created(report_id=rid, user_id=user_id)
    logger.info(
        "job_enqueued",
        extra={
            "job_id": job.id,
            "job_type": job.type,
            "report_id": rid,
        },
    )
    return report


@app.get("/reports/{report_id}", response_model=Report)
def get_report(report_id: str):
    report = REPORTS.get(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="report_not_found")
    return report


@app.get("/jobs", response_model=list[Job])
def list_jobs():
    return JOB_QUEUE.list_jobs()


@app.post("/jobs/next", response_model=Job)
def get_next_job(req: NextJobRequest):
    job = JOB_QUEUE.next_job()
    if not job:
        return Response(status_code=204)

    logger.info(
        "job_claimed",
        extra={
            "job_id": job.id,
            "worker_id": req.worker_id,
        },
    )
    return job


@app.post("/jobs/{job_id}/complete", response_model=Job)
def complete_job(job_id: str, req: JobResultRequest):
    job = JOB_QUEUE.complete(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="job_not_found")

    logger.info(
        "job_completed",
        extra={
            "job_id": job.id,
            "worker_id": req.worker_id,
            "ok": req.ok,
        },
    )
    return job


@app.post("/jobs/{job_id}/fail", response_model=Job)
def fail_job(job_id: str, req: JobResultRequest):
    job = JOB_QUEUE.fail(job_id, error=req.error or "unknown_error")
    if not job:
        raise HTTPException(status_code=404, detail="job_not_found")

    if job.type == "report_created":
        report_id = job.payload.report_id
        report = REPORTS.get(report_id)
        if report:
            report.status = "failed"
            REPORTS[report_id] = report

    logger.info(
        "job_failed",
        extra={
            "job_id": job.id,
            "worker_id": req.worker_id,
            "error_text": job.error,
        },
    )
    return job


@app.post("/events/upsert-from-report", response_model=UpsertFromReportResponse)
def upsert_event_from_report(req: UpsertFromReportRequest):
    global LAST_ERROR

    try:
        report = REPORTS.get(req.report_id)
        if not report:
            raise HTTPException(status_code=404, detail="report_not_found")

        report.status = "processing"
        REPORTS[report.id] = report

        event, created = EVENTS.upsert_from_report(report, REPORTS)
        REPORT_TO_EVENT[report.id] = event.id

        linked_reports = [
            REPORTS[rid]
            for rid in event.report_ids
            if rid in REPORTS
        ]
        event.briefing = build_briefing(event, linked_reports)
        EVENTS.events[event.id] = event

        report.status = "ready"
        REPORTS[report.id] = report

        logger.info(
            "event_upserted",
            extra={
                "event_id": event.id,
                "event_created": created,
                "report_id": report.id,
                "cell": event.cell_id,
                "status": event.status,
                "resolved_at": event.resolved_at.isoformat() if event.resolved_at else None,
                "report_count": event.report_count,
                "unique_report_count": event.unique_report_count,
                "duplicate_report_count": event.duplicate_report_count,
                "report_is_duplicate": report.is_duplicate,
                "duplicate_of": report.duplicate_of,
                "trend": event.trend,
                "first_seen_at": event.first_seen_at.isoformat(),
                "last_seen_at": event.last_seen_at.isoformat(),
                "minutes_since_last_report": event.minutes_since_last_report,
                "is_recent": event.is_recent,
                "report_velocity_per_hour": event.report_velocity_per_hour,
                "ranking_score": event.ranking_score,
            },
        )

        return UpsertFromReportResponse(event_id=event.id, created=created)

    except HTTPException as e:
        LAST_ERROR = {
            "where": "events_upsert_from_report_http",
            "report_id": req.report_id,
            "error": str(e.detail),
        }
        raise

    except Exception as e:
        LAST_ERROR = {
            "where": "events_upsert_from_report",
            "report_id": req.report_id,
            "error": str(e),
        }

        logger.exception(
            "events_upsert_failed",
            extra={
                "report_id": req.report_id,
                "error_text": str(e),
            },
        )

        raise HTTPException(status_code=500, detail=f"events_upsert_failed: {str(e)}")


@app.get("/feed", response_model=list[FeedItem])
def get_feed():
    events = EVENTS.list_active()
    items: list[FeedItem] = []

    for event in events:
        latest_report_id = event.report_ids[-1] if event.report_ids else None
        items.append(
            FeedItem(
                event=event,
                latest_report_id=latest_report_id,
            )
        )

    return items


@app.get("/events/{event_id}", response_model=Event)
def get_event(event_id: str):
    event = EVENTS.get(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="event_not_found")
    return event


@app.get("/events/{event_id}/reports", response_model=list[Report])
def get_event_reports(event_id: str):
    event = EVENTS.get(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="event_not_found")

    reports = [
        REPORTS[report_id]
        for report_id in event.report_ids
        if report_id in REPORTS
    ]

    reports.sort(key=lambda report: report.created_at)
    return reports