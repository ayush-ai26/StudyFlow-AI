"""Shared dependencies, models and helpers for StudyFlow AI backend."""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Literal, List

from fastapi import Header, Cookie, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, conint

# ---------------------------------------------------------------------------
# Mongo client (single shared instance)
# ---------------------------------------------------------------------------
_mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(_mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    is_guest: bool = False
    created_at: datetime


# Tasks ---------------------------------------------------------------------
class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    type: Literal["task", "assignment", "exam"] = "task"
    subject: Optional[str] = ""
    due_date: Optional[str] = None
    priority: Literal["low", "medium", "high"] = "medium"


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    type: Optional[Literal["task", "assignment", "exam"]] = None
    subject: Optional[str] = None
    due_date: Optional[str] = None
    priority: Optional[Literal["low", "medium", "high"]] = None
    completed: Optional[bool] = None


# Notes ---------------------------------------------------------------------
class NoteCreate(BaseModel):
    title: str
    content: str = ""
    subject: Optional[str] = ""


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    subject: Optional[str] = None


# Pomodoro ------------------------------------------------------------------
class PomodoroCreate(BaseModel):
    duration_minutes: conint(ge=1, le=240)
    subject: Optional[str] = ""


# Prep progress -------------------------------------------------------------
class PrepUpdate(BaseModel):
    sat_progress: Optional[conint(ge=0, le=100)] = None
    ielts_progress: Optional[conint(ge=0, le=100)] = None
    sat_target_date: Optional[str] = None
    ielts_target_date: Optional[str] = None


# Chat ----------------------------------------------------------------------
class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


class ScheduleRequest(BaseModel):
    goal: str
    available_hours_per_day: conint(ge=1, le=24) = 3
    days: conint(ge=1, le=30) = 7
    subjects: List[str] = []


# ---------------------------------------------------------------------------
# Auth helpers (FastAPI dependencies)
# ---------------------------------------------------------------------------
def _extract_token(authorization: Optional[str], session_token: Optional[str]) -> Optional[str]:
    if authorization and authorization.lower().startswith("bearer "):
        return authorization.split(" ", 1)[1].strip()
    if session_token:
        return session_token
    return None


async def get_current_user_optional(
    authorization: Optional[str] = Header(None),
    session_token: Optional[str] = Cookie(None),
) -> Optional[User]:
    token = _extract_token(authorization, session_token)
    if not token:
        return None

    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        return None

    expires_at = session.get("expires_at")
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at and expires_at < now_utc():
        return None

    user_doc = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user_doc:
        return None
    return User(**user_doc)


async def require_user(
    authorization: Optional[str] = Header(None),
    session_token: Optional[str] = Cookie(None),
) -> User:
    user = await get_current_user_optional(authorization, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


async def create_session(user_id: str, session_token: Optional[str] = None) -> str:
    token = session_token or f"local_{uuid.uuid4().hex}"
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": token,
        "expires_at": now_utc() + timedelta(days=7),
        "created_at": now_utc(),
    })
    return token
