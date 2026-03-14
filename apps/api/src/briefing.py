from typing import List

from packages.shared.briefing import EventBriefing, BriefingSourceStats, SeverityLevel
from packages.shared.models import Event, Report


HIGH_SEVERITY_KEYWORDS = {
    "fire",
    "explosion",
    "shooting",
    "gun",
    "gunshot",
    "crash",
    "collision",
    "accident",
    "injury",
    "injured",
    "ambulance",
    "emergency",
    "police",
    "flood",
    "collapsed",
    "collapse",
    "earthquake",
    "downed power line",
    "power outage",
}

MEDIUM_SEVERITY_KEYWORDS = {
    "traffic",
    "congestion",
    "road closed",
    "delay",
    "outage",
    "smoke",
    "crowd",
    "protest",
    "sirens",
    "blocked",
    "hazard",
    "weather",
}


def _normalize_text(text: str) -> str:
    return " ".join(text.lower().strip().split())


def _extract_tags(text: str) -> List[str]:
    normalized = _normalize_text(text)
    tags: List[str] = []

    tag_rules = [
        ("traffic", ["traffic", "congestion", "intersection", "road", "blocked"]),
        ("power", ["power outage", "outage", "downed power line"]),
        ("fire", ["fire", "smoke", "explosion"]),
        ("medical", ["injury", "injured", "ambulance", "emergency"]),
        ("police", ["police", "sirens", "shooting", "gun", "gunshot"]),
        ("weather", ["flood", "storm", "weather", "rain"]),
    ]

    for tag, keywords in tag_rules:
        if any(keyword in normalized for keyword in keywords):
            tags.append(tag)

    return tags[:5]


def _severity_from_text_and_count(text: str, report_count: int) -> tuple[SeverityLevel, int]:
    normalized = _normalize_text(text)

    if any(keyword in normalized for keyword in HIGH_SEVERITY_KEYWORDS):
        if report_count >= 3:
            return "critical", 5
        return "high", 4

    if any(keyword in normalized for keyword in MEDIUM_SEVERITY_KEYWORDS):
        if report_count >= 3:
            return "high", 4
        return "medium", 3

    if report_count >= 4:
        return "medium", 3

    return "low", 1


def _confidence_from_report_count(report_count: int) -> float:
    if report_count <= 1:
        return 0.52
    if report_count == 2:
        return 0.64
    if report_count == 3:
        return 0.76
    if report_count == 4:
        return 0.84
    return 0.9


def _recommended_actions(severity: SeverityLevel, tags: List[str]) -> List[str]:
    actions: List[str] = []

    if "traffic" in tags:
        actions.append("Avoid the immediate area and expect delays.")
    if "power" in tags:
        actions.append("Use caution around affected infrastructure and dark intersections.")
    if "fire" in tags:
        actions.append("Keep distance from the area and follow local emergency guidance.")
    if "medical" in tags or "police" in tags:
        actions.append("Do not obstruct first responders.")
    if "weather" in tags:
        actions.append("Monitor local conditions and avoid flooded or hazardous routes.")

    if not actions:
        if severity in ("high", "critical"):
            actions.append("Use caution and avoid the immediate area until more information is available.")
        else:
            actions.append("Monitor the situation for updates before changing plans.")

    return actions[:4]


def build_briefing(event: Event, reports: List[Report]) -> EventBriefing:
    latest_report = reports[-1] if reports else None
    latest_text = latest_report.text if latest_report else "Community reports indicate a developing situation."

    severity_label, severity_score = _severity_from_text_and_count(
        latest_text,
        event.report_count,
    )
    confidence = _confidence_from_report_count(event.report_count)
    tags = _extract_tags(latest_text)

    title = event.title
    if severity_label in ("high", "critical"):
        title = "Potential high-priority incident"
    elif event.report_count >= 3:
        title = "Active community-reported situation"
    elif event.report_count >= 2:
        title = "Developing local situation"
    else:
        title = "Situation forming"

    summary = (
        f"{event.report_count} community report(s) indicate a developing situation near the reported area. "
        f"Latest signal: {latest_text}"
    )

    has_media = any(report.media_url for report in reports)

    briefing = EventBriefing(
        title=title,
        summary=summary,
        severity=severity_label,
        confidence=confidence,
        recommended_actions=_recommended_actions(severity_label, tags),
        tags=tags,
        source_stats=BriefingSourceStats(
            report_count=event.report_count,
            has_media=has_media,
        ),
    )

    # Keeping numeric event fields aligned with briefing
    event.title = title
    event.severity = severity_score
    event.confidence = confidence

    return briefing