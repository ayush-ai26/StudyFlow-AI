"""Pomodoro router."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends

from deps import PomodoroCreate, User, db, now_utc, require_user

router = APIRouter(prefix="/pomodoro", tags=["pomodoro"])


@router.post("")
async def log_pomodoro(payload: PomodoroCreate, user: User = Depends(require_user)):
    session = {
        "id": str(uuid.uuid4()),
        "user_id": user.user_id,
        "duration_minutes": payload.duration_minutes,
        "subject": payload.subject or "",
        "completed_at": now_utc(),
    }
    await db.pomodoro_sessions.insert_one(session)
    session.pop("_id", None)
    return session


@router.get("")
async def list_pomodoro(user: User = Depends(require_user)):
    return await db.pomodoro_sessions.find(
        {"user_id": user.user_id}, {"_id": 0}
    ).sort("completed_at", -1).to_list(500)
