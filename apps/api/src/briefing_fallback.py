from collections import Counter
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


def _extract_tags_from_reports(reports: List[Report]) -> List[str]:
    combined = " ".join(_normalize_text(report.text) for report in reports)
    tags: List[str] = []

    tag_rules = [
        ("traffic", ["traffic", "congestion", "intersection", "road", "blocked", "accident", "crash"]),
        ("power", ["power outage", "outage", "downed power line"]),
        ("fire", ["fire", "smoke", "explosion"]),
        ("medical", ["injury", "injured", "ambulance", "emergency"]),
        ("police", ["police", "sirens", "shooting", "gun", "gunshot"]),
        ("weather", ["flood", "storm", "weather", "rain"]),
    ]

    for tag, keywords in tag_rules:
        if any(keyword in combined for keyword in keywords):
            tags.append(tag)

    return tags[:5]


def _severity_from_reports(reports: List[Report], unique_report_count: int) -> tuple[SeverityLevel, int]:
    combined = " ".join(_normalize_text(report.text) for report in reports)

    if any(keyword in combined for keyword in HIGH_SEVERITY_KEYWORDS):
        if unique_report_count >= 3:
            return "critical", 5
        return "high", 4

    if any(keyword in combined for keyword in MEDIUM_SEVERITY_KEYWORDS):
        if unique_report_count >= 3:
            return "high", 4
        return "medium", 3

    if unique_report_count >= 4:
        return "medium", 3

    return "low", 1


def _confidence_from_reports(unique_report_count: int, duplicate_report_count: int) -> float:
    if unique_report_count <= 1:
        base = 0.52
    elif unique_report_count == 2:
        base = 0.68
    elif unique_report_count == 3:
        base = 0.8
    elif unique_report_count == 4:
        base = 0.88
    else:
        base = 0.92

    duplicate_bonus = min(duplicate_report_count * 0.01, 0.04)
    return min(round(base + duplicate_bonus, 2), 0.96)


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


def _build_summary(event: Event, reports: List[Report]) -> str:
    if not reports:
        return "Community reports indicate a developing situation in the area."

    normalized_texts = [_normalize_text(report.text) for report in reports]
    counts = Counter(normalized_texts)
    most_common_text, _ = counts.most_common(1)[0]

    if event.status == "resolved":
        return (
            f"This incident appears resolved or stale. "
            f"It accumulated {event.unique_report_count} unique reports and "
            f"{event.duplicate_report_count} duplicate reports. "
            f"Most repeated signal: {most_common_text}"
        )

    if event.status == "cooling_down":
        return (
            f"This incident appears to be cooling down. "
            f"It accumulated {event.unique_report_count} unique reports and "
            f"{event.duplicate_report_count} duplicate reports. "
            f"Most repeated signal: {most_common_text}"
        )

    if event.unique_report_count == 1:
        return f"1 unique community report indicates a newly observed situation. Latest signal: {reports[-1].text}"

    if event.trend == "growing":
        return (
            f"{event.unique_report_count} unique reports and {event.duplicate_report_count} duplicate reports "
            f"are reinforcing the same situation in this area. Most repeated signal: {most_common_text}"
        )

    return (
        f"{event.unique_report_count} unique reports and {event.duplicate_report_count} duplicate reports "
        f"indicate an ongoing situation in the same area. Most repeated signal: {most_common_text}"
    )
