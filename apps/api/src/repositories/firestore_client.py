from google.cloud import firestore

from packages.core.config import settings


def get_firestore_client() -> firestore.Client:
    if settings.GCP_PROJECT_ID:
        return firestore.Client(
            project=settings.GCP_PROJECT_ID,
            database=settings.FIRESTORE_DATABASE,
        )

    return firestore.Client(database=settings.FIRESTORE_DATABASE)