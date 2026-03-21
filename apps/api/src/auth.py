from typing import Optional

import firebase_admin
from firebase_admin import auth as firebase_auth
from fastapi import Header, HTTPException


FIREBASE_PROJECT_ID = "crowdlens-886a3"


def init_firebase_admin() -> None:
    if firebase_admin._apps:
        return

    firebase_admin.initialize_app(
        options={
            "projectId": FIREBASE_PROJECT_ID,
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
        print("FIREBASE_VERIFY_ERROR", str(exc))
        raise HTTPException(status_code=401, detail="invalid_auth_token")