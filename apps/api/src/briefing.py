import json
import logging
from typing import List

from google import genai

from packages.core.config import settings
from packages.shared.briefing import EventBriefing
from packages.shared.models import Event, Report
from apps.api.src.briefing_fallback import build_fallback_briefing

logger = logging.getLogger("api")


def _build_prompt(event: Event, reports: List[Report]) -> str:
    report_lines = []
    for idx, report in enumerate(reports, start=1):
        report_lines.append(
            f"{idx}. text={report.text!r}, duplicate={report.is_duplicate}, created_at={report.created_at.isoformat()}"
        )

    return f"""
You are generating a structured incident briefing for CrowdLens.

Return ONLY valid JSON matching this schema:
{{
  "title": string,
  "summary": string,
  "severity": "low" | "medium" | "high" | "critical",
  "confidence": number,
  "recommended_actions": string[],
  "tags": string[],
  "source_stats": {{
    "report_count": integer,
    "has_media": boolean
  }}
}}

Context:
- event_status: {event.status}
- event_trend: {event.trend}
- total_reports: {event.report_count}
- unique_reports: {event.unique_report_count}
- duplicate_reports: {event.duplicate_report_count}
- minutes_since_last_report: {event.minutes_since_last_report}

Reports:
{chr(10).join(report_lines)}

Instructions:
- Be concise and factual.
- Do not invent facts not supported by reports.
- Treat duplicate reports as weaker support than unique reports.
- Keep title under 120 chars.
- Keep summary under 500 chars.
- Use practical recommended actions.
- Tags should be short lowercase labels.
""".strip()


def _severity_score_from_label(label: str) -> int:
    mapping = {
        "low": 1,
        "medium": 3,
        "high": 4,
        "critical": 5,
    }
    return mapping.get(label, 3)


def build_briefing(event: Event, reports: List[Report]) -> EventBriefing:
    if not settings.AI_BRIEFING_ENABLED or not settings.GEMINI_API_KEY:
        return build_fallback_briefing(event, reports)

    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)

        prompt = _build_prompt(event, reports)

        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
        )

        raw_text = (response.text or "").strip()
        parsed = json.loads(raw_text)
        briefing = EventBriefing.model_validate(parsed)

        event.title = briefing.title
        event.confidence = briefing.confidence
        event.severity = _severity_score_from_label(briefing.severity)

        logger.info(
            "ai_briefing_generated",
            extra={
                "event_status": event.status,
                "report_count": event.report_count,
                "unique_report_count": event.unique_report_count,
                "briefing_title": briefing.title,
                "briefing_severity": briefing.severity,
            },
        )

        return briefing

    except Exception as exc:
        logger.warning(
            "ai_briefing_fallback",
            extra={"error_text": str(exc)},
        )
        return build_fallback_briefing(event, reports)