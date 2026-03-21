import logging
from typing import Optional

import firebase_admin
from firebase_admin import auth as firebase_auth
from fastapi import Header, HTTPException

from packages.core.config import settings

logger = logging.getLogger("api")


def init_firebase_admin() -> None:
    if firebase_admin._apps:
        return

    firebase_admin.initialize_app(
        options={
            "projectId": settings.GCP_PROJECT_ID,
        }
    )


def verify_bearer_token(authorization: Optional[str] = Header(default=None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="missing_bearer_token")

    token = authorization.split(" ", 1)[1].strip()

    try:
        decoded = firebase_auth.verify_id_token(token)
        return decoded
    except Exception as exc:
        logger.exception("firebase_token_verification_failed", extra={"error_text": str(exc)})
        raise HTTPException(status_code=401, detail="invalid_auth_token")