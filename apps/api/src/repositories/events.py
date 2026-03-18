from typing import List, Optional

from packages.core.config import settings
from packages.shared.models import Event
from apps.api.src.repositories.firestore_client import get_firestore_client


class FirestoreEventRepository:
    def __init__(self) -> None:
        self.client = get_firestore_client()
        self.collection = self.client.collection(settings.FIRESTORE_EVENTS_COLLECTION)

    def save(self, event: Event) -> None:
        self.collection.document(event.id).set(event.model_dump(mode="python"))

    def get(self, event_id: str) -> Optional[Event]:
        snapshot = self.collection.document(event_id).get()
        if not snapshot.exists:
            return None
        data = snapshot.to_dict() or {}
        return Event.model_validate(data)

    def get_by_cell(self, cell_id: str) -> Optional[Event]:
        query = self.collection.where("cell_id", "==", cell_id).limit(1)
        docs = list(query.stream())
        if not docs:
            return None
        data = docs[0].to_dict() or {}
        return Event.model_validate(data)

    def list_feed(self) -> List[Event]:
        docs = list(self.collection.stream())
        events: List[Event] = []

        for doc in docs:
            data = doc.to_dict() or {}
            events.append(Event.model_validate(data))

        events.sort(
            key=lambda event: (event.ranking_score, event.updated_at),
            reverse=True,
        )
        return events