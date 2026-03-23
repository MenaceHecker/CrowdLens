from datetime import datetime, timezone
from typing import Optional

from apps.api.src.repositories.firestore_client import get_firestore_client
from packages.core.config import settings
from packages.shared.models import UserProfile


class FirestoreUserRepository:
    def __init__(self) -> None:
        self.client = get_firestore_client()
        self.collection = self.client.collection(settings.FIRESTORE_USERS_COLLECTION)

    def get(self, user_id: str) -> Optional[UserProfile]:
        snapshot = self.collection.document(user_id).get()
        if not snapshot.exists:
            return None
        data = snapshot.to_dict() or {}
        return UserProfile.model_validate(data)

    def save(self, profile: UserProfile) -> None:
        self.collection.document(profile.user_id).set(profile.model_dump(mode="python"))

    def get_or_create(self, user_id: str) -> UserProfile:
        existing = self.get(user_id)
        if existing:
            return existing

        now = datetime.now(timezone.utc)
        profile = UserProfile(
            user_id=user_id,
            created_at=now,
            updated_at=now,
            reputation_score=settings.USER_REPUTATION_DEFAULT,
        )
        self.save(profile)
        return profile