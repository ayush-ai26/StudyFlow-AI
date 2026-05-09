"""StudyFlow AI - FastAPI entrypoint."""
from __future__ import annotations

import logging
from pathlib import Path

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Import routers AFTER load_dotenv so deps.py picks up env vars correctly.
from deps import client  # noqa: E402
from routers import ai as ai_router  # noqa: E402
from routers import analytics as analytics_router  # noqa: E402
from routers import auth as auth_router  # noqa: E402
from routers import notes as notes_router  # noqa: E402
from routers import pomodoro as pomodoro_router  # noqa: E402
from routers import prep as prep_router  # noqa: E402
from routers import tasks as tasks_router  # noqa: E402

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="StudyFlow AI API")
api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"message": "StudyFlow AI API", "ok": True}


api_router.include_router(auth_router.router)
api_router.include_router(tasks_router.router)
api_router.include_router(notes_router.router)
api_router.include_router(pomodoro_router.router)
api_router.include_router(prep_router.router)
api_router.include_router(analytics_router.router)
api_router.include_router(ai_router.router)

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
