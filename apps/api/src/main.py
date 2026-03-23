import logging
import traceback
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import FastAPI, Request, HTTPException, Response, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from fastapi import Depends
from apps.api.src.auth import init_firebase_admin, verify_bearer_token

from apps.api.src.trust import compute_report_trust_score

from apps.api.src.repositories.users import FirestoreUserRepository
from apps.api.src.reputation import apply_low_quality_rejection, apply_report_submission
from apps.api.src.trust import compute_report_trust_score

from apps.api.src.abuse import (
    enforce_duplicate_submission_rule,
    enforce_report_text_quality,
    enforce_submission_cooldown,
)

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
from apps.api.src.briefing import build_briefing
from apps.api.src.ws import WebSocketManager
from apps.api.src.events import (
    compute_cell_id,
    refresh_event_metrics,
    upsert_event_from_report as upsert_event_from_report_domain,
)
from apps.api.src.repositories.reports import FirestoreReportRepository
from apps.api.src.repositories.events import FirestoreEventRepository
from apps.api.src.services.tasks import CloudTasksService
from apps.api.src.services.storage import StorageService


setup_logging(service="api", level=settings.LOG_LEVEL)
logger = logging.getLogger("api")

app = FastAPI(title="CrowdLens API", version="0.1.0")
init_firebase_admin()

JOB_QUEUE = InMemoryJobQueue()
LAST_ERROR: dict | None = None
WS_MANAGER = WebSocketManager()

report_repo = FirestoreReportRepository()
event_repo = FirestoreEventRepository()
tasks_service = CloudTasksService()
storage_service = StorageService()

user_repo = FirestoreUserRepository()


class UpsertFromReportRequest(BaseModel):
    report_id: str = Field(..., min_length=1)


class UpsertFromReportResponse(BaseModel):
    event_id: str
    created: bool


class MediaUploadUrlRequest(BaseModel):
    filename: str = Field(..., min_length=1)
    content_type: str = Field(..., min_length=1)


class MediaUploadUrlResponse(BaseModel):
    object_name: str
    upload_url: str
    view_url: str
    content_type: str


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

    return JSONResponse(status_code=500, content={"error": "internal_error"})


@app.get("/healthz")
def healthz():
    return {
        "ok": True,
        "service": "api",
        "env": settings.APP_ENV,
        "time": datetime.now(timezone.utc).isoformat(),
        "use_cloud_tasks": settings.USE_CLOUD_TASKS,
    }


@app.get("/debug/last-error")
def debug_last_error():
    return LAST_ERROR or {"ok": True, "last_error": None}


@app.post("/media/upload-url", response_model=MediaUploadUrlResponse)
def create_media_upload_url(
    payload: MediaUploadUrlRequest,
    auth_user: dict = Depends(verify_bearer_token),):
    if not settings.GCS_BUCKET_NAME:
        raise HTTPException(status_code=500, detail="gcs_bucket_not_configured")

    ext = payload.filename.split(".")[-1] if "." in payload.filename else "bin"
    object_name = f"reports/{uuid4()}.{ext}"

    bundle = storage_service.generate_upload_bundle(
        object_name=object_name,
        content_type=payload.content_type,
    )
    return MediaUploadUrlResponse(**bundle)


@app.post("/reports", response_model=Report)
def create_report(
    payload: CreateReportRequest,
    auth_user: dict = Depends(verify_bearer_token),
):
    rid = str(uuid4())
    user_id = auth_user["uid"]
    now = datetime.now(timezone.utc)

    profile = user_repo.get_or_create(user_id)

    try:
        enforce_report_text_quality(payload.text)
    except HTTPException:
        profile = apply_low_quality_rejection(profile)
        user_repo.save(profile)
        raise

    recent_reports = report_repo.list_by_user_id(user_id=user_id, limit=20)
    enforce_submission_cooldown(recent_reports, now=now)
    enforce_duplicate_submission_rule(payload.text, recent_reports, now=now)

    report = Report(
        id=rid,
        user_id=user_id,
        text=payload.text,
        location=payload.location,
        occurred_at=payload.occurred_at,
        created_at=now,
        status="queued",
        media_url=payload.media_url,
    )

    report.trust_score = compute_report_trust_score(report, profile)

    report_repo.save(report)

    profile = apply_report_submission(profile, report)
    user_repo.save(profile)

    if settings.USE_CLOUD_TASKS:
        task_info = tasks_service.create_process_report_task(report_id=rid)
        logger.info(
            "cloud_task_enqueued",
            extra={
                "report_id": rid,
                "task_name": task_info["task_name"],
                "target_url": task_info["target_url"],
                "user_id": user_id,
                "trust_score": report.trust_score,
                "reputation_score": profile.reputation_score,
            },
        )
    else:
        job = JOB_QUEUE.enqueue_report_created(report_id=rid, user_id=user_id)
        logger.info(
            "job_enqueued",
            extra={
                "job_id": job.id,
                "job_type": job.type,
                "report_id": rid,
                "user_id": user_id,
                "trust_score": report.trust_score,
                "reputation_score": profile.reputation_score,
            },
        )

    return report


@app.get("/reports/{report_id}", response_model=Report)
def get_report(report_id: str):
    report = report_repo.get(report_id)
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

    logger.info("job_claimed", extra={"job_id": job.id, "worker_id": req.worker_id})
    return job


@app.post("/jobs/{job_id}/complete", response_model=Job)
def complete_job(job_id: str, req: JobResultRequest):
    job = JOB_QUEUE.complete(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="job_not_found")

    logger.info("job_completed", extra={"job_id": job.id, "worker_id": req.worker_id, "ok": req.ok})
    return job


@app.post("/jobs/{job_id}/fail", response_model=Job)
def fail_job(job_id: str, req: JobResultRequest):
    job = JOB_QUEUE.fail(job_id, error=req.error or "unknown_error")
    if not job:
        raise HTTPException(status_code=404, detail="job_not_found")

    if job.type == "report_created":
        report = report_repo.get(job.payload.report_id)
        if report:
            report.status = "failed"
            report_repo.save(report)

    logger.info("job_failed", extra={"job_id": job.id, "worker_id": req.worker_id, "error_text": job.error})
    return job


@app.post("/events/upsert-from-report", response_model=UpsertFromReportResponse)
async def upsert_event_from_report_endpoint(req: UpsertFromReportRequest):
    global LAST_ERROR

    try:
        report = report_repo.get(req.report_id)
        if not report:
            raise HTTPException(status_code=404, detail="report_not_found")

        report.status = "processing"
        report_repo.save(report)

        cell_id = compute_cell_id(report.location.lat, report.location.lng)
        existing_event = event_repo.get_by_cell(cell_id)

        existing_reports = []
        if existing_event and existing_event.report_ids:
            existing_reports = report_repo.get_many(existing_event.report_ids)

        event, created = upsert_event_from_report_domain(existing_event, report, existing_reports)

        linked_reports = list(existing_reports)
        linked_reports.append(report)

        event.briefing = build_briefing(event, linked_reports)

        report.status = "ready"
        report_repo.save(report)
        event_repo.save(event)

        logger.info(
            "event_upserted",
            extra={
                "event_id": event.id,
                "event_created": created,
                "report_id": report.id,
                "cell": event.cell_id,
                "status": event.status,
                "incident_type": event.briefing.incident_type if event.briefing else None,
                "report_count": event.report_count,
                "unique_report_count": event.unique_report_count,
                "duplicate_report_count": event.duplicate_report_count,
                "ranking_score": event.ranking_score,
            },
        )

        await WS_MANAGER.broadcast_feed_updated()
        await WS_MANAGER.broadcast_event_updated(event.id)

        return UpsertFromReportResponse(event_id=event.id, created=created)

    except HTTPException as e:
        LAST_ERROR = {
            "where": "events_upsert_from_report_http",
            "report_id": req.report_id,
            "error": str(e.detail),
        }
        raise

    except Exception as e:
        tb = "".join(traceback.format_exception(type(e), e, e.__traceback__))
        LAST_ERROR = {
            "where": "events_upsert_from_report",
            "report_id": req.report_id,
            "error": str(e),
            "traceback": tb[-8000:],
        }
        logger.exception("events_upsert_failed", extra={"report_id": req.report_id, "error_text": str(e)})
        raise HTTPException(status_code=500, detail=f"events_upsert_failed: {str(e)}")


@app.get("/feed", response_model=list[FeedItem])
def get_feed():
    events = [refresh_event_metrics(event) for event in event_repo.list_feed()]
    items: list[FeedItem] = []

    for event in events:
        latest_report_id = event.report_ids[-1] if event.report_ids else None
        items.append(FeedItem(event=event, latest_report_id=latest_report_id))

    return items


@app.get("/events/{event_id}", response_model=Event)
def get_event(event_id: str):
    event = event_repo.get(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="event_not_found")
    return refresh_event_metrics(event)


@app.get("/events/{event_id}/reports", response_model=list[Report])
def get_event_reports(event_id: str):
    event = event_repo.get(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="event_not_found")

    reports = report_repo.get_many(event.report_ids)
    reports.sort(key=lambda report: report.created_at)
    return reports


@app.websocket("/ws/feed")
async def websocket_feed(websocket: WebSocket):
    await WS_MANAGER.connect_feed(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        WS_MANAGER.disconnect_feed(websocket)
    except Exception:
        WS_MANAGER.disconnect_feed(websocket)


@app.websocket("/ws/events/{event_id}")
async def websocket_event(event_id: str, websocket: WebSocket):
    await WS_MANAGER.connect_event(event_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        WS_MANAGER.disconnect_event(event_id, websocket)
    except Exception:
        WS_MANAGER.disconnect_event(event_id, websocket)