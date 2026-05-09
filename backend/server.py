from fastapi import FastAPI, APIRouter, HTTPException, Header, Cookie, Request, Response
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import httpx
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

app = FastAPI(title="StudyFlow AI API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# =====================================================================
# Models
# =====================================================================
def now_utc():
    return datetime.now(timezone.utc)


class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    is_guest: bool = False
    created_at: datetime


class Task(BaseModel):
    id: str
    user_id: str
    title: str
    description: Optional[str] = ""
    type: Literal["task", "assignment", "exam"] = "task"
    subject: Optional[str] = ""
    due_date: Optional[str] = None  # ISO date string
    priority: Literal["low", "medium", "high"] = "medium"
    completed: bool = False
    created_at: datetime


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
    type: Optional[str] = None
    subject: Optional[str] = None
    due_date: Optional[str] = None
    priority: Optional[str] = None
    completed: Optional[bool] = None


class Note(BaseModel):
    id: str
    user_id: str
    title: str
    content: str
    subject: Optional[str] = ""
    created_at: datetime
    updated_at: datetime


class NoteCreate(BaseModel):
    title: str
    content: str = ""
    subject: Optional[str] = ""


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    subject: Optional[str] = None


class PomodoroSession(BaseModel):
    id: str
    user_id: str
    duration_minutes: int
    subject: Optional[str] = ""
    completed_at: datetime


class PomodoroCreate(BaseModel):
    duration_minutes: int
    subject: Optional[str] = ""


class PrepProgress(BaseModel):
    user_id: str
    sat_progress: int = 0  # 0-100
    ielts_progress: int = 0
    sat_target_date: Optional[str] = None
    ielts_target_date: Optional[str] = None
    updated_at: datetime


class PrepUpdate(BaseModel):
    sat_progress: Optional[int] = None
    ielts_progress: Optional[int] = None
    sat_target_date: Optional[str] = None
    ielts_target_date: Optional[str] = None


class ChatMessage(BaseModel):
    id: str
    user_id: str
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


class ScheduleRequest(BaseModel):
    goal: str
    available_hours_per_day: int = 3
    days: int = 7
    subjects: List[str] = []


# =====================================================================
# Auth helpers
# =====================================================================
async def get_current_user_optional(
    authorization: Optional[str] = Header(None),
    session_token: Optional[str] = Cookie(None),
) -> Optional[User]:
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
    elif session_token:
        token = session_token
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


# =====================================================================
# Auth Routes
# =====================================================================
@api_router.post("/auth/session")
async def auth_session(request: Request, response: Response):
    """Exchange Emergent session_id for our session token."""
    data = await request.json()
    session_id = data.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")

    async with httpx.AsyncClient(timeout=15.0) as http_client:
        try:
            r = await http_client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id},
            )
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


@api_router.post("/auth/guest")
async def auth_guest():
    """Create a guest user and session."""
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


@api_router.get("/auth/me")
async def get_me(user: User = None, authorization: Optional[str] = Header(None), session_token: Optional[str] = Cookie(None)):
    user = await get_current_user_optional(authorization, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


@api_router.post("/auth/logout")
async def logout(response: Response, authorization: Optional[str] = Header(None), session_token: Optional[str] = Cookie(None)):
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
    elif session_token:
        token = session_token
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


# =====================================================================
# Tasks Routes
# =====================================================================
@api_router.get("/tasks")
async def list_tasks(
    type: Optional[str] = None,
    authorization: Optional[str] = Header(None),
    session_token: Optional[str] = Cookie(None),
):
    user = await require_user(authorization, session_token)
    q = {"user_id": user.user_id}
    if type:
        q["type"] = type
    tasks = await db.tasks.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return tasks


@api_router.post("/tasks")
async def create_task(
    payload: TaskCreate,
    authorization: Optional[str] = Header(None),
    session_token: Optional[str] = Cookie(None),
):
    user = await require_user(authorization, session_token)
    task = {
        "id": str(uuid.uuid4()),
        "user_id": user.user_id,
        "title": payload.title,
        "description": payload.description or "",
        "type": payload.type,
        "subject": payload.subject or "",
        "due_date": payload.due_date,
        "priority": payload.priority,
        "completed": False,
        "created_at": now_utc(),
    }
    await db.tasks.insert_one(task)
    task.pop("_id", None)
    return task


@api_router.patch("/tasks/{task_id}")
async def update_task(
    task_id: str,
    payload: TaskUpdate,
    authorization: Optional[str] = Header(None),
    session_token: Optional[str] = Cookie(None),
):
    user = await require_user(authorization, session_token)
    update = {k: v for k, v in payload.dict().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = await db.tasks.update_one({"id": task_id, "user_id": user.user_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    return task


@api_router.delete("/tasks/{task_id}")
async def delete_task(
    task_id: str,
    authorization: Optional[str] = Header(None),
    session_token: Optional[str] = Cookie(None),
):
    user = await require_user(authorization, session_token)
    await db.tasks.delete_one({"id": task_id, "user_id": user.user_id})
    return {"ok": True}


# =====================================================================
# Notes Routes
# =====================================================================
@api_router.get("/notes")
async def list_notes(
    authorization: Optional[str] = Header(None),
    session_token: Optional[str] = Cookie(None),
):
    user = await require_user(authorization, session_token)
    notes = await db.notes.find({"user_id": user.user_id}, {"_id": 0}).sort("updated_at", -1).to_list(1000)
    return notes


@api_router.post("/notes")
async def create_note(
    payload: NoteCreate,
    authorization: Optional[str] = Header(None),
    session_token: Optional[str] = Cookie(None),
):
    user = await require_user(authorization, session_token)
    note = {
        "id": str(uuid.uuid4()),
        "user_id": user.user_id,
        "title": payload.title,
        "content": payload.content or "",
        "subject": payload.subject or "",
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    await db.notes.insert_one(note)
    note.pop("_id", None)
    return note


@api_router.patch("/notes/{note_id}")
async def update_note(
    note_id: str,
    payload: NoteUpdate,
    authorization: Optional[str] = Header(None),
    session_token: Optional[str] = Cookie(None),
):
    user = await require_user(authorization, session_token)
    update = {k: v for k, v in payload.dict().items() if v is not None}
    update["updated_at"] = now_utc()
    res = await db.notes.update_one({"id": note_id, "user_id": user.user_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Note not found")
    note = await db.notes.find_one({"id": note_id}, {"_id": 0})
    return note


@api_router.delete("/notes/{note_id}")
async def delete_note(
    note_id: str,
    authorization: Optional[str] = Header(None),
    session_token: Optional[str] = Cookie(None),
):
    user = await require_user(authorization, session_token)
    await db.notes.delete_one({"id": note_id, "user_id": user.user_id})
    return {"ok": True}


# =====================================================================
# Pomodoro Routes
# =====================================================================
@api_router.post("/pomodoro")
async def log_pomodoro(
    payload: PomodoroCreate,
    authorization: Optional[str] = Header(None),
    session_token: Optional[str] = Cookie(None),
):
    user = await require_user(authorization, session_token)
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


@api_router.get("/pomodoro")
async def list_pomodoro(
    authorization: Optional[str] = Header(None),
    session_token: Optional[str] = Cookie(None),
):
    user = await require_user(authorization, session_token)
    sessions = await db.pomodoro_sessions.find(
        {"user_id": user.user_id}, {"_id": 0}
    ).sort("completed_at", -1).to_list(500)
    return sessions


# =====================================================================
# SAT/IELTS Prep Routes
# =====================================================================
@api_router.get("/prep")
async def get_prep(
    authorization: Optional[str] = Header(None),
    session_token: Optional[str] = Cookie(None),
):
    user = await require_user(authorization, session_token)
    prep = await db.prep_progress.find_one({"user_id": user.user_id}, {"_id": 0})
    if not prep:
        prep = {
            "user_id": user.user_id,
            "sat_progress": 0,
            "ielts_progress": 0,
            "sat_target_date": None,
            "ielts_target_date": None,
            "updated_at": now_utc(),
        }
        await db.prep_progress.insert_one(prep.copy())
        prep.pop("_id", None)
    return prep


@api_router.patch("/prep")
async def update_prep(
    payload: PrepUpdate,
    authorization: Optional[str] = Header(None),
    session_token: Optional[str] = Cookie(None),
):
    user = await require_user(authorization, session_token)
    update = {k: v for k, v in payload.dict().items() if v is not None}
    update["updated_at"] = now_utc()
    await db.prep_progress.update_one(
        {"user_id": user.user_id},
        {"$set": update, "$setOnInsert": {"user_id": user.user_id}},
        upsert=True,
    )
    prep = await db.prep_progress.find_one({"user_id": user.user_id}, {"_id": 0})
    return prep


# =====================================================================
# Analytics Route
# =====================================================================
@api_router.get("/analytics/summary")
async def analytics_summary(
    authorization: Optional[str] = Header(None),
    session_token: Optional[str] = Cookie(None),
):
    user = await require_user(authorization, session_token)
    today = now_utc().replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today - timedelta(days=6)

    # Tasks
    total_tasks = await db.tasks.count_documents({"user_id": user.user_id})
    completed_tasks = await db.tasks.count_documents({"user_id": user.user_id, "completed": True})

    # Pomodoro
    pomos = await db.pomodoro_sessions.find(
        {"user_id": user.user_id, "completed_at": {"$gte": week_start}}, {"_id": 0}
    ).to_list(1000)

    # Daily breakdown
    daily = {}
    for i in range(7):
        d = (week_start + timedelta(days=i)).strftime("%Y-%m-%d")
        daily[d] = 0
    for p in pomos:
        completed_at = p.get("completed_at")
        if isinstance(completed_at, datetime):
            if completed_at.tzinfo is None:
                completed_at = completed_at.replace(tzinfo=timezone.utc)
            d = completed_at.strftime("%Y-%m-%d")
            if d in daily:
                daily[d] += p.get("duration_minutes", 0)

    total_minutes = sum(daily.values())

    # Streak: consecutive days from today backwards with at least 1 pomodoro session
    all_pomos = await db.pomodoro_sessions.find({"user_id": user.user_id}, {"_id": 0}).to_list(5000)
    days_with_study = set()
    for p in all_pomos:
        completed_at = p.get("completed_at")
        if isinstance(completed_at, datetime):
            if completed_at.tzinfo is None:
                completed_at = completed_at.replace(tzinfo=timezone.utc)
            days_with_study.add(completed_at.strftime("%Y-%m-%d"))

    streak = 0
    cursor = today
    while cursor.strftime("%Y-%m-%d") in days_with_study:
        streak += 1
        cursor -= timedelta(days=1)

    return {
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "completion_rate": round((completed_tasks / total_tasks * 100), 1) if total_tasks else 0,
        "weekly_minutes": total_minutes,
        "weekly_hours": round(total_minutes / 60, 1),
        "daily_minutes": [{"date": k, "minutes": v} for k, v in sorted(daily.items())],
        "streak_days": streak,
        "total_sessions": len(all_pomos),
    }


# =====================================================================
# AI Chatbot Routes (GPT-5.2 via emergentintegrations)
# =====================================================================
@api_router.get("/chat/history")
async def chat_history(
    authorization: Optional[str] = Header(None),
    session_token: Optional[str] = Cookie(None),
):
    user = await require_user(authorization, session_token)
    msgs = await db.chat_messages.find(
        {"user_id": user.user_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(500)
    return msgs


@api_router.post("/chat")
async def chat(
    payload: ChatRequest,
    authorization: Optional[str] = Header(None),
    session_token: Optional[str] = Cookie(None),
):
    user = await require_user(authorization, session_token)

    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="LLM key not configured")

    from emergentintegrations.llm.chat import LlmChat, UserMessage

    session_id = payload.session_id or f"chat_{user.user_id}"

    # Save user message
    user_msg = {
        "id": str(uuid.uuid4()),
        "user_id": user.user_id,
        "role": "user",
        "content": payload.message,
        "created_at": now_utc(),
    }
    await db.chat_messages.insert_one(user_msg.copy())

    # Build chat with history (re-inject prior context)
    history = await db.chat_messages.find(
        {"user_id": user.user_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(50)

    system_prompt = (
        "You are StudyFlow AI, a friendly and concise study assistant for students. "
        "Help with study schedules, exam prep (especially SAT and IELTS), explaining concepts, "
        "summarizing topics, and providing motivation. Keep responses focused and actionable. "
        "Use markdown sparingly. Prefer bullet lists for plans."
    )

    try:
        chat_client = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message=system_prompt,
        ).with_model("openai", "gpt-5.2")

        # Send only the latest message; library is multi-turn within instance,
        # but we recreate per request, so include short history context.
        if len(history) > 1:
            context = "\n".join([f"{m['role']}: {m['content']}" for m in history[:-1][-10:]])
            full_message = f"Previous conversation:\n{context}\n\nUser: {payload.message}"
        else:
            full_message = payload.message

        response_text = await chat_client.send_message(UserMessage(text=full_message))
    except Exception as e:
        logger.error(f"LLM error: {e}")
        raise HTTPException(status_code=500, detail=f"AI error: {str(e)}")

    assistant_msg = {
        "id": str(uuid.uuid4()),
        "user_id": user.user_id,
        "role": "assistant",
        "content": response_text,
        "created_at": now_utc(),
    }
    await db.chat_messages.insert_one(assistant_msg.copy())

    user_msg.pop("_id", None)
    assistant_msg.pop("_id", None)
    return {"user": user_msg, "assistant": assistant_msg}


@api_router.delete("/chat/history")
async def clear_chat(
    authorization: Optional[str] = Header(None),
    session_token: Optional[str] = Cookie(None),
):
    user = await require_user(authorization, session_token)
    await db.chat_messages.delete_many({"user_id": user.user_id})
    return {"ok": True}


# =====================================================================
# AI Schedule Generator
# =====================================================================
@api_router.post("/ai/schedule")
async def generate_schedule(
    payload: ScheduleRequest,
    authorization: Optional[str] = Header(None),
    session_token: Optional[str] = Cookie(None),
):
    user = await require_user(authorization, session_token)
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="LLM key not configured")

    from emergentintegrations.llm.chat import LlmChat, UserMessage

    subjects_str = ", ".join(payload.subjects) if payload.subjects else "general"
    prompt = (
        f"Create a {payload.days}-day study plan for this goal: '{payload.goal}'. "
        f"Available time: {payload.available_hours_per_day} hours/day. "
        f"Subjects: {subjects_str}. "
        "Return ONLY a JSON array (no markdown fences) of objects with keys: "
        "day (1..N), title, subject, duration_minutes, focus. "
        "Keep titles short. Output JSON only."
    )

    try:
        chat_client = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"plan_{user.user_id}_{uuid.uuid4().hex[:8]}",
            system_message="You output strict JSON arrays only. No markdown, no commentary.",
        ).with_model("openai", "gpt-5.2")

        response_text = await chat_client.send_message(UserMessage(text=prompt))
    except Exception as e:
        logger.error(f"AI schedule error: {e}")
        raise HTTPException(status_code=500, detail=f"AI error: {str(e)}")

    # Try to parse JSON robustly
    import json
    cleaned = response_text.strip()
    if cleaned.startswith("```"):
        # remove fences
        cleaned = cleaned.strip("`")
        # remove leading "json\n" if present
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()
    try:
        plan = json.loads(cleaned)
    except Exception:
        # find first [ ... ]
        start = cleaned.find("[")
        end = cleaned.rfind("]")
        if start != -1 and end != -1:
            try:
                plan = json.loads(cleaned[start:end + 1])
            except Exception:
                plan = []
        else:
            plan = []

    return {"plan": plan, "raw": response_text}


# =====================================================================
# Misc
# =====================================================================
@api_router.get("/")
async def root():
    return {"message": "StudyFlow AI API", "ok": True}


# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
