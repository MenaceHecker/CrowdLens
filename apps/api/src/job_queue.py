from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional, Dict, List
from uuid import uuid4

from packages.shared.models import Job, JobPayload


@dataclass
class InMemoryJobQueue:
    """
    Local-dev only in-memory queue.
    Not persistent, not multi-process safe. Perfect for Option A.
    """

    jobs: Dict[str, Job]

    def __init__(self) -> None:
        self.jobs = {}

    def enqueue_report_created(self, report_id: str, user_id: str) -> Job:
        jid = str(uuid4())
        now = datetime.now(timezone.utc)
        job = Job(
            id=jid,
            type="report_created",
            status="queued",
            payload=JobPayload(report_id=report_id, user_id=user_id),
            created_at=now,
        )
        self.jobs[jid] = job
        return job

    def list_jobs(self) -> List[Job]:
        # newest first
        return sorted(self.jobs.values(), key=lambda j: j.created_at, reverse=True)

    def next_job(self) -> Optional[Job]:
        # FIFO by created_at
        queued = [j for j in self.jobs.values() if j.status == "queued"]
        if not queued:
            return None
        queued.sort(key=lambda j: j.created_at)
        job = queued[0]
        job.status = "processing"
        job.started_at = datetime.now(timezone.utc)
        self.jobs[job.id] = job
        return job

    def complete(self, job_id: str) -> Optional[Job]:
        job = self.jobs.get(job_id)
        if not job:
            return None
        job.status = "done"
        job.finished_at = datetime.now(timezone.utc)
        self.jobs[job_id] = job
        return job

    def fail(self, job_id: str, error: str) -> Optional[Job]:
        job = self.jobs.get(job_id)
        if not job:
            return None
        job.status = "failed"
        job.error = error[:2000]
        job.finished_at = datetime.now(timezone.utc)
        self.jobs[job_id] = job
        return job