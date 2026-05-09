"""Analytics router."""
from __future__ import annotations

from datetime import timedelta, timezone, datetime

from fastapi import APIRouter, Depends

from deps import User, db, now_utc, require_user

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/summary")
async def analytics_summary(user: User = Depends(require_user)):
    today = now_utc().replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today - timedelta(days=6)

    total_tasks = await db.tasks.count_documents({"user_id": user.user_id})
    completed_tasks = await db.tasks.count_documents({"user_id": user.user_id, "completed": True})

    pomos = await db.pomodoro_sessions.find(
        {"user_id": user.user_id, "completed_at": {"$gte": week_start}}, {"_id": 0}
    ).to_list(1000)

    daily = {(week_start + timedelta(days=i)).strftime("%Y-%m-%d"): 0 for i in range(7)}
    for p in pomos:
        completed_at = p.get("completed_at")
        if isinstance(completed_at, datetime):
            if completed_at.tzinfo is None:
                completed_at = completed_at.replace(tzinfo=timezone.utc)
            d = completed_at.strftime("%Y-%m-%d")
            if d in daily:
                daily[d] += p.get("duration_minutes", 0)

    total_minutes = sum(daily.values())

    all_pomos = await db.pomodoro_sessions.find({"user_id": user.user_id}, {"_id": 0}).to_list(5000)
    days_with_study = set()
    for p in all_pomos:
        ca = p.get("completed_at")
        if isinstance(ca, datetime):
            if ca.tzinfo is None:
                ca = ca.replace(tzinfo=timezone.utc)
            days_with_study.add(ca.strftime("%Y-%m-%d"))

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
