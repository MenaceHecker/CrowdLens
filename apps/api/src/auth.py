import base64
import json
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


def _decode_jwt_payload_without_verification(token: str) -> dict:
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return {"error": "invalid_jwt_format"}

        payload = parts[1]
        padding = "=" * (-len(payload) % 4)
        decoded = base64.urlsafe_b64decode(payload + padding)
        return json.loads(decoded.decode("utf-8"))
    except Exception as exc:
        return {"error": f"payload_decode_failed: {exc}"}


def verify_bearer_token(authorization: Optional[str] = Header(default=None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="missing_bearer_token")

    token = authorization.split(" ", 1)[1].strip()

    raw_payload = _decode_jwt_payload_without_verification(token)
    logger.info(
        "firebase_token_received",
        extra={
            "gcp_project_id": settings.GCP_PROJECT_ID,
            "token_aud": raw_payload.get("aud"),
            "token_iss": raw_payload.get("iss"),
            "token_sub": raw_payload.get("sub"),
            "token_email": raw_payload.get("email"),
            "token_payload": raw_payload,
        },
    )

    try:
        decoded = firebase_auth.verify_id_token(token)
        logger.info(
            "firebase_token_verified",
            extra={
                "uid": decoded.get("uid"),
                "email": decoded.get("email"),
                "aud": decoded.get("aud"),
                "iss": decoded.get("iss"),
            },
        )
        return decoded
    except Exception as exc:
        logger.exception(
            "firebase_token_verification_failed",
            extra={
                "error_text": str(exc),
                "gcp_project_id": settings.GCP_PROJECT_ID,
                "token_aud": raw_payload.get("aud"),
                "token_iss": raw_payload.get("iss"),
                "token_sub": raw_payload.get("sub"),
                "token_email": raw_payload.get("email"),
            },
        )
        raise HTTPException(status_code=401, detail="invalid_auth_token")