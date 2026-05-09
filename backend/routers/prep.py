"""SAT/IELTS prep progress router."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from deps import PrepUpdate, User, db, now_utc, require_user

router = APIRouter(prefix="/prep", tags=["prep"])


@router.get("")
async def get_prep(user: User = Depends(require_user)):
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


@router.patch("")
async def update_prep(payload: PrepUpdate, user: User = Depends(require_user)):
    update = {k: v for k, v in payload.dict().items() if v is not None}
    update["updated_at"] = now_utc()
    await db.prep_progress.update_one(
        {"user_id": user.user_id},
        {"$set": update, "$setOnInsert": {"user_id": user.user_id}},
        upsert=True,
    )
    return await db.prep_progress.find_one({"user_id": user.user_id}, {"_id": 0})
