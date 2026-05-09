"""Notes router."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException

from deps import NoteCreate, NoteUpdate, User, db, now_utc, require_user

router = APIRouter(prefix="/notes", tags=["notes"])


@router.get("")
async def list_notes(user: User = Depends(require_user)):
    return await db.notes.find({"user_id": user.user_id}, {"_id": 0}).sort("updated_at", -1).to_list(1000)


@router.post("")
async def create_note(payload: NoteCreate, user: User = Depends(require_user)):
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


@router.patch("/{note_id}")
async def update_note(note_id: str, payload: NoteUpdate, user: User = Depends(require_user)):
    update = {k: v for k, v in payload.dict().items() if v is not None}
    update["updated_at"] = now_utc()
    res = await db.notes.update_one({"id": note_id, "user_id": user.user_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Note not found")
    return await db.notes.find_one({"id": note_id}, {"_id": 0})


@router.delete("/{note_id}")
async def delete_note(note_id: str, user: User = Depends(require_user)):
    await db.notes.delete_one({"id": note_id, "user_id": user.user_id})
    return {"ok": True}
