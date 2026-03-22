from typing import List, Optional

from packages.core.config import settings
from packages.shared.models import Report
from apps.api.src.repositories.firestore_client import get_firestore_client


class FirestoreReportRepository:
    def __init__(self) -> None:
        self.client = get_firestore_client()
        self.collection = self.client.collection(settings.FIRESTORE_REPORTS_COLLECTION)

    def save(self, report: Report) -> None:
        self.collection.document(report.id).set(report.model_dump(mode="python"))

    def get(self, report_id: str) -> Optional[Report]:
        snapshot = self.collection.document(report_id).get()
        if not snapshot.exists:
            return None
        data = snapshot.to_dict() or {}
        return Report.model_validate(data)

    def get_many(self, report_ids: List[str]) -> List[Report]:
        reports: List[Report] = []
        for report_id in report_ids:
            report = self.get(report_id)
            if report:
                reports.append(report)
        return reports

    def list_by_user_id(self, user_id: str, limit: int = 20) -> List[Report]:
        query = (
            self.collection
            .where("user_id", "==", user_id)
            .order_by("created_at", direction="DESCENDING")
            .limit(limit)
        )

        results: List[Report] = []
        for doc in query.stream():
            data = doc.to_dict() or {}
            results.append(Report.model_validate(data))
        return results