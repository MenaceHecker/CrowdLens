from packages.core.config import settings
from packages.shared.models import Report


def normalize_report_text(text: str) -> str:
    return " ".join(text.lower().strip().split())


def is_low_signal_text(text: str) -> bool:
    normalized = normalize_report_text(text)

    if len(normalized) < settings.REPORT_MIN_TEXT_LENGTH:
        return True

    blocked_exact = {
        "test",
        "testing",
        "hello",
        "hi",
        "aaa",
        "aaaa",
        "aaaaa",
        "12345678",
        ".........",
    }
    if normalized in blocked_exact:
        return True