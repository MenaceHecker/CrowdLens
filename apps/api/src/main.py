import logging
from datetime import datetime, timezone
from uuid import uuid4
from fastapi import FastAPI, Request, HTTPException, Response
from fastapi.responses import JSONResponse

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


LAST_ERROR: dict | None = None
setup_logging(service="api", level=settings.LOG_LEVEL)
logger = logging.getLogger("api")

app = FastAPI(title="CrowdLens API", version="0.1.0")

REPORTS: dict[str, Report] = {}
JOB_QUEUE = InMemoryJobQueue()
EVENTS = InMemoryEventStore()

# report_id -> event_id mapping (local)
REPORT_TO_EVENT: dict[str, str] = {}

@app.post("/jobs/next", response_model=Job)
def get_next_job(req: NextJobRequest):
    job = JOB_QUEUE.next_job()
    if not job:
        return Response(status_code=204)

    logger.info("job_claimed", extra={"job_id": job.id, "worker_id": req.worker_id})
    return job


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
    logger.exception("unhandled_exception", extra={"path": request.url.path})
    return JSONResponse(status_code=500, content={"error": "internal_error"})


@app.get("/healthz")
def healthz():
    return {
        "ok": True,
        "service": "api",
        "env": settings.APP_ENV,
        "time": datetime.now(timezone.utc).isoformat(),
    }


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
    logger.info("job_enqueued", extra={"job_id": job.id, "type": job.type, "report_id": rid})
    return report


@app.get("/reports/{report_id}", response_model=Report)
def get_report(report_id: str):
    report = REPORTS.get(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="report_not_found")
    return report


# -------- Local Job Queue Endpoints (Option A) --------

@app.get("/jobs", response_model=list[Job])
def list_jobs():
    return JOB_QUEUE.list_jobs()


@app.post("/jobs/next", response_model=Job)
def get_next_job(req: NextJobRequest):
    job = JOB_QUEUE.next_job()
    if not job:
        raise HTTPException(status_code=204, detail="no_jobs")
    logger.info("job_claimed", extra={"job_id": job.id, "worker_id": req.worker_id})
    return job


@app.post("/jobs/{job_id}/complete", response_model=Job)
def complete_job(job_id: str, req: JobResultRequest):
    global LAST_ERROR
    job = JOB_QUEUE.jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="job_not_found")

    try:
        if job.type == "report_created":
            report_id = job.payload.report_id
            report = REPORTS.get(report_id)
            if report:
                report.status = "processing"
                REPORTS[report_id] = report

                event, created = EVENTS.upsert_from_report(report, REPORTS)
                REPORT_TO_EVENT[report_id] = event.id

                report.status = "ready"
                REPORTS[report_id] = report

                logger.info(
                    "event_upserted",
                    extra={
                        "event_id": event.id,
                        "created": created,
                        "report_id": report_id,
                        "cell": event.cell_id,
                    },
                )

        # Only now mark the job done
        job = JOB_QUEUE.complete(job_id)
        if not job:
            raise RuntimeError("job_missing_after_complete")

        logger.info("job_completed", extra={"job_id": job.id, "worker_id": req.worker_id, "ok": req.ok})
        return job

    except Exception as e:
        # Store the real error for easy debugging
        LAST_ERROR = {
            "where": "jobs_complete",
            "job_id": job_id,
            "worker_id": req.worker_id,
            "error": str(e),
        }

        logger.exception(
            "job_complete_failed",
            extra={"job_id": job_id, "worker_id": req.worker_id, "error": str(e)},
        )

        # Mark job failed 
        JOB_QUEUE.fail(job_id, error=str(e))

        # Also mark report failed 
        if job.type == "report_created":
            report_id = job.payload.report_id
            report = REPORTS.get(report_id)
            if report:
                report.status = "failed"
                REPORTS[report_id] = report

        # Return the real error string in the response 
        raise HTTPException(status_code=500, detail=f"job_complete_failed: {str(e)}")


@app.post("/jobs/{job_id}/fail", response_model=Job)
def fail_job(job_id: str, req: JobResultRequest):
    global LAST_ERROR

    job = JOB_QUEUE.fail(job_id, error=req.error or "unknown_error")
    if not job:
        raise HTTPException(status_code=404, detail="job_not_found")

    LAST_ERROR = {
        "where": "jobs_fail",
        "job_id": job_id,
        "worker_id": req.worker_id,
        "error": job.error,
    }

    if job.type == "report_created":
        report_id = job.payload.report_id
        report = REPORTS.get(report_id)
        if report:
            report.status = "failed"
            REPORTS[report_id] = report

    logger.info("job_failed", extra={"job_id": job.id, "worker_id": req.worker_id, "error": job.error})
    return job


# -------- Events + Feed --------

@app.get("/feed", response_model=list[FeedItem])
def get_feed():
    events = EVENTS.list_active()
    items: list[FeedItem] = []
    for e in events:
        latest_report_id = e.report_ids[-1] if e.report_ids else None
        items.append(FeedItem(event=e, latest_report_id=latest_report_id))
    return items


@app.get("/events/{event_id}", response_model=Event)
def get_event(event_id: str):
    event = EVENTS.get(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="event_not_found")
    return event

@app.get("/debug/last-error")
def debug_last_error():
    return LAST_ERROR or {"ok": True, "last_error": None}