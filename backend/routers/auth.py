"""Auth router: Emergent Google OAuth + Guest mode."""
from __future__ import annotations

import logging
import uuid
from typing import Optional

import httpx
from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Request, Response

from deps import User, create_session, db, get_current_user_optional, now_utc

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])

EMERGENT_AUTH_API = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"


@router.post("/session")
async def auth_session(request: Request, response: Response):
    data = await request.json()
    session_id = data.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")

    async with httpx.AsyncClient(timeout=15.0) as http_client:
        try:
            r = await http_client.get(EMERGENT_AUTH_API, headers={"X-Session-ID": session_id})
            r.raise_for_status()
            user_data = r.json()
        except Exception as e:
            logger.error(f"Emergent auth failed: {e}")
            raise HTTPException(status_code=401, detail="Failed to verify session")

    email = user_data.get("email")
    name = user_data.get("name") or "Student"
    picture = user_data.get("picture")
    emergent_session_token = user_data.get("session_token")

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "is_guest": False,
            "created_at": now_utc(),
        })

    token = await create_session(user_id, emergent_session_token)

    response.set_cookie(
        key="session_token",
        value=token,
        max_age=7 * 24 * 60 * 60,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
    )

    return {
        "session_token": token,
        "user": {
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "is_guest": False,
        },
    }


@router.post("/guest")
async def auth_guest():
    user_id = f"guest_{uuid.uuid4().hex[:12]}"
    name = "Guest Student"
    await db.users.insert_one({
        "user_id": user_id,
        "email": f"{user_id}@guest.local",
        "name": name,
        "picture": None,
        "is_guest": True,
        "created_at": now_utc(),
    })
    token = await create_session(user_id)
    return {
        "session_token": token,
        "user": {
            "user_id": user_id,
            "email": f"{user_id}@guest.local",
            "name": name,
            "picture": None,
            "is_guest": True,
        },
    }


@router.get("/me")
async def get_me(
    authorization: Optional[str] = Header(None),
    session_token: Optional[str] = Cookie(None),
):
    user = await get_current_user_optional(authorization, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


@router.post("/logout")
async def logout(
    response: Response,
    authorization: Optional[str] = Header(None),
    session_token: Optional[str] = Cookie(None),
):
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
    elif session_token:
        token = session_token
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}
