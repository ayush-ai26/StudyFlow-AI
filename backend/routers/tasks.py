"""Tasks router."""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from deps import TaskCreate, TaskUpdate, User, db, now_utc, require_user

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("")
async def list_tasks(type: Optional[str] = None, user: User = Depends(require_user)):
    q = {"user_id": user.user_id}
    if type:
        q["type"] = type
    return await db.tasks.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)


@router.post("")
async def create_task(payload: TaskCreate, user: User = Depends(require_user)):
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


@router.patch("/{task_id}")
async def update_task(task_id: str, payload: TaskUpdate, user: User = Depends(require_user)):
    update = {k: v for k, v in payload.dict().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = await db.tasks.update_one({"id": task_id, "user_id": user.user_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return await db.tasks.find_one({"id": task_id}, {"_id": 0})


@router.delete("/{task_id}")
async def delete_task(task_id: str, user: User = Depends(require_user)):
    await db.tasks.delete_one({"id": task_id, "user_id": user.user_id})
    return {"ok": True}
