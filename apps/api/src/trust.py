from packages.shared.models import Report


def compute_report_trust_score(report: Report) -> float:
    score = 0.6

    text = report.text.lower().strip()

    if len(text) >= 25:
        score += 0.05

    if len(text) >= 60:
        score += 0.05

    if report.media_url:
        score += 0.15

    if any(word in text for word in ["police", "ambulance", "fire", "crash", "accident", "smoke", "injured"]):
        score += 0.05

    if report.is_duplicate:
        score -= 0.2

    if report.duplicate_of:
        score -= 0.05

    return max(0.1, min(1.0, round(score, 2)))