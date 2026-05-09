"""AI chat + schedule generator router (GPT-5.2 via emergentintegrations)."""
from __future__ import annotations

import json
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException

from deps import (
    EMERGENT_LLM_KEY,
    ChatRequest,
    ScheduleRequest,
    User,
    db,
    now_utc,
    require_user,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["ai"])


@router.get("/chat/history")
async def chat_history(user: User = Depends(require_user)):
    return await db.chat_messages.find(
        {"user_id": user.user_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(500)


@router.post("/chat")
async def chat(payload: ChatRequest, user: User = Depends(require_user)):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="LLM key not configured")

    from emergentintegrations.llm.chat import LlmChat, UserMessage

    session_id = payload.session_id or f"chat_{user.user_id}"

    user_msg = {
        "id": str(uuid.uuid4()),
        "user_id": user.user_id,
        "role": "user",
        "content": payload.message,
        "created_at": now_utc(),
    }
    await db.chat_messages.insert_one(user_msg.copy())

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


@router.delete("/chat/history")
async def clear_chat(user: User = Depends(require_user)):
    await db.chat_messages.delete_many({"user_id": user.user_id})
    return {"ok": True}


@router.post("/ai/schedule")
async def generate_schedule(payload: ScheduleRequest, user: User = Depends(require_user)):
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

    cleaned = response_text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()
    try:
        plan = json.loads(cleaned)
    except Exception:
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
