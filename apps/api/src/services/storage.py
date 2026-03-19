from datetime import timedelta
from typing import Optional
from uuid import uuid4

from google.cloud import storage

from packages.core.config import settings


class StorageService:
    def __init__(self) -> None:
        self.client = storage.Client(project=settings.GCP_PROJECT_ID or None)
        if not settings.GCS_BUCKET_NAME:
            raise ValueError("GCS_BUCKET_NAME is required for media upload support")
        self.bucket = self.client.bucket(settings.GCS_BUCKET_NAME)

    def build_object_path(self, filename: str) -> str:
        safe_name = filename.rsplit("/", 1)[-1]
        return f"reports/{uuid4()}/{safe_name}"

    def generate_upload_signed_url(
        self,
        object_path: str,
        content_type: str,
    ) -> str:
        blob = self.bucket.blob(object_path)
        return blob.generate_signed_url(
            version="v4",
            expiration=timedelta(minutes=settings.MEDIA_SIGNED_URL_EXPIRATION_MINUTES),
            method="PUT",
            content_type=content_type,
        )

    def generate_read_signed_url(self, object_path: str) -> str:
        blob = self.bucket.blob(object_path)
        return blob.generate_signed_url(
            version="v4",
            expiration=timedelta(minutes=settings.MEDIA_SIGNED_URL_EXPIRATION_MINUTES),
            method="GET",
        )