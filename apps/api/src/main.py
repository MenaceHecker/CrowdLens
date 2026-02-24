import logging
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from packages.shared.models import CreateReportRequest, Report
from packages.core.config import settings
from packages.core.logging import setup_logging

setup_logging(service="api", level=settings.LOG_LEVEL)
logger = logging.getLogger("api")

app = FastAPI(title="CrowdLens API", version="0.1.0")

# Option A local dev store (temporary)
REPORTS: dict[str, Report] = {}

@app.middleware("http")
async def request_logging(request: Request, call_next):
    start = datetime.now(timezone.utc)
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
    logger.info("report_created", extra={"report_id": rid})
    return report
