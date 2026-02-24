import logging
import os
from pythonjsonlogger import jsonlogger

def setup_logging(service: str, level: str = "INFO") -> None:
    """
    Structured JSON logs (Cloud Run friendly).
    - Writes to stdout
    - Includes service/env metadata
    """
    root = logging.getLogger()
    root.setLevel(level.upper())

    # Cleared any pre-existing handlers 
    while root.handlers:
        root.handlers.pop()

    handler = logging.StreamHandler()
    formatter = jsonlogger.JsonFormatter(
        "%(asctime)s %(levelname)s %(name)s %(message)s %(service)s %(env)s"
    )
    handler.setFormatter(formatter)

    root.addHandler(handler)

    # Added default fields for every record
    old_factory = logging.getLogRecordFactory()

    def record_factory(*args, **kwargs):
        record = old_factory(*args, **kwargs)
        record.service = service
        record.env = os.getenv("APP_ENV", "local")
        return record

    logging.setLogRecordFactory(record_factory)