from datetime import timedelta

import google.auth
from google.auth.transport.requests import Request
from google.cloud import storage

from packages.core.config import settings


class StorageService:
    def __init__(self) -> None:
        self.client = storage.Client(project=settings.GCP_PROJECT_ID or None)
        self.bucket = self.client.bucket(settings.GCS_BUCKET_NAME)

    def generate_upload_bundle(self, object_name: str, content_type: str) -> dict:
        blob = self.bucket.blob(object_name)

        credentials, _ = google.auth.default()
        credentials.refresh(Request())

        service_account_email = getattr(credentials, "service_account_email", None)
        access_token = credentials.token

        if not service_account_email:
            raise RuntimeError("service_account_email_not_available_for_signed_url")

        upload_url = blob.generate_signed_url(
            version="v4",
            expiration=timedelta(minutes=15),
            method="PUT",
            content_type=content_type,
            service_account_email=service_account_email,
            access_token=access_token,
        )

        view_url = blob.generate_signed_url(
            version="v4",
            expiration=timedelta(days=7),
            method="GET",
            service_account_email=service_account_email,
            access_token=access_token,
        )

        return {
            "object_name": object_name,
            "upload_url": upload_url,
            "view_url": view_url,
            "content_type": content_type,
        }