import logging
import os
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException

from packages.core.config import settings
from packages.core.logging import setup_logging
from packages.shared.models import Job, NextJobRequest, JobResultRequest


setup_logging(service="worker", level=settings.LOG_LEVEL)
logger = logging.getLogger("worker")

app = FastAPI(title="CrowdLens Worker", version="0.1.0")

API_BASE = os.getenv("API_BASE", "http://localhost:8000")
WORKER_ID = os.getenv("WORKER_ID", "worker-local-1")


@app.get("/healthz")
def healthz():
    logger.info("health_check")
    return {
        "ok": True,
        "service": "worker",
        "env": settings.APP_ENV,
        "time": datetime.now(timezone.utc).isoformat(),
        "api_base": API_BASE,
        "worker_id": WORKER_ID,
    }


async def _fetch_next_job(client: httpx.AsyncClient) -> Optional[Job]:
    resp = await client.post(
        f"{API_BASE}/jobs/next",
        json=NextJobRequest(worker_id=WORKER_ID).model_dump(),
    )
    if resp.status_code == 204:
        return None
    resp.raise_for_status()
    return Job.model_validate(resp.json())


async def _upsert_event_from_report(client: httpx.AsyncClient, report_id: str) -> None:
    resp = await client.post(
        f"{API_BASE}/events/upsert-from-report",
        json={"report_id": report_id},
    )
    if resp.status_code >= 400:
        logger.error(
            "api_upsert_failed",
            extra={"status_code": resp.status_code, "body": resp.text[:2000], "report_id": report_id},
        )
    resp.raise_for_status()


async def _complete_job(client: httpx.AsyncClient, job_id: str) -> None:
    payload = JobResultRequest(worker_id=WORKER_ID, ok=True).model_dump()
    resp = await client.post(f"{API_BASE}/jobs/{job_id}/complete", json=payload)
    if resp.status_code >= 400:
        logger.error(
            "api_complete_failed",
            extra={"status_code": resp.status_code, "body": resp.text[:2000], "job_id": job_id},
        )
    resp.raise_for_status()


async def _fail_job(client: httpx.AsyncClient, job_id: str, error: str) -> None:
    payload = JobResultRequest(worker_id=WORKER_ID, ok=False, error=error).model_dump()
    resp = await client.post(f"{API_BASE}/jobs/{job_id}/fail", json=payload)
    resp.raise_for_status()


@app.post("/jobs/run-once")
async def run_once():
    """
    Pull exactly one job and process it.
    This simulates the worker consuming Pub/Sub or Cloud Tasks later.
    """
    async with httpx.AsyncClient(timeout=10.0) as client:
        job = await _fetch_next_job(client)
        if not job:
            return {"ok": True, "ran": False, "reason": "no_jobs"}

        logger.info("job_processing_started", extra={"job_id": job.id, "type": job.type})

        try:
            if job.type == "report_created":
                await _upsert_event_from_report(client, job.payload.report_id)
            else:
                raise ValueError(f"unsupported_job_type: {job.type}")

            await _complete_job(client, job.id)
            logger.info("job_processing_done", extra={"job_id": job.id})
            return {"ok": True, "ran": True, "job_id": job.id}

        except Exception as e:
            err = str(e)
            logger.exception("job_processing_failed", extra={"job_id": job.id, "error": err})
            await _fail_job(client, job.id, err)
            raise HTTPException(status_code=500, detail="job_failed")