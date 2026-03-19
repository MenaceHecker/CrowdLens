from datetime import timedelta

from google.cloud import storage

from packages.core.config import settings


class StorageService:
    def __init__(self) -> None:
        self.client = storage.Client(project=settings.GCP_PROJECT_ID or None)
        self.bucket = self.client.bucket(settings.GCS_BUCKET_NAME)

    def generate_upload_bundle(self, object_name: str, content_type: str) -> dict:
        blob = self.bucket.blob(object_name)

        upload_url = blob.generate_signed_url(
            version="v4",
            expiration=timedelta(minutes=15),
            method="PUT",
            content_type=content_type,
        )

        view_url = blob.generate_signed_url(
            version="v4",
            expiration=timedelta(days=7),
            method="GET",
        )

        return {
            "object_name": object_name,
            "upload_url": upload_url,
            "view_url": view_url,
            "content_type": content_type,
        }