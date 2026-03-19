import json
from typing import Optional

from google.cloud import tasks_v2
from google.protobuf import timestamp_pb2

from packages.core.config import settings


class CloudTasksService:
    def __init__(self) -> None:
        self.client = tasks_v2.CloudTasksClient()

    def _queue_path(self) -> str:
        return self.client.queue_path(
            settings.GCP_PROJECT_ID,
            settings.TASKS_LOCATION,
            settings.TASKS_QUEUE_NAME,
        )

    def create_process_report_task(
        self,
        report_id: str,
        schedule_seconds_from_now: Optional[int] = None,
    ) -> dict:
        if not settings.GCP_PROJECT_ID:
            raise ValueError("GCP_PROJECT_ID is required when USE_CLOUD_TASKS=true")

        target_url = f"{settings.WORKER_URL.rstrip('/')}/tasks/process-report"
        payload = json.dumps({"report_id": report_id}).encode()

        task: dict = {
            "http_request": {
                "http_method": tasks_v2.HttpMethod.POST,
                "url": target_url,
                "headers": {
                    "Content-type": "application/json",
                },
                "body": payload,
            }
        }

        if settings.TASKS_SERVICE_ACCOUNT_EMAIL:
            task["http_request"]["oidc_token"] = {
                "service_account_email": settings.TASKS_SERVICE_ACCOUNT_EMAIL,
            }

        if schedule_seconds_from_now:
            ts = timestamp_pb2.Timestamp()
            from datetime import datetime, timedelta, timezone

            ts.FromDatetime(datetime.now(timezone.utc) + timedelta(seconds=schedule_seconds_from_now))
            task["schedule_time"] = ts

        response = self.client.create_task(
            request={
                "parent": self._queue_path(),
                "task": task,
            }
        )

        return {
            "task_name": response.name,
            "target_url": target_url,
        }