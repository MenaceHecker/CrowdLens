import logging
from datetime import datetime, timezone

from packages.core.config import settings
from packages.core.logging import setup_logging
from fastapi import FastAPI

app = FastAPI(title="CrowdLens Worker", version="0.1.0")

setup_logging(service="worker", level=settings.LOG_LEVEL)
logger = logging.getLogger("worker")

@app.get("/healthz")
def healthz():
    logger.info("health_check")
    return {
        "ok": True,
        "service": "worker",
        "env": settings.APP_ENV,
        "time": datetime.now(timezone.utc).isoformat(),
    }
