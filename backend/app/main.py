"""App entry point: creates tables, seeds data, wires up routes and CORS."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import CORS_ORIGIN_REGEX, CORS_ORIGINS
from app.database import Base, SessionLocal, add_missing_columns, engine
from app.routers import auth, documents, meetings, notifications, participants, team_chat, users
from app.seed import (
    ensure_demo_password,
    keep_sample_chats_private,
    refresh_sample_meetings,
    seed_database,
    seed_docs,
    seed_team_chat,
)
from app.services.errors import ServiceError


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Small app, so we create tables directly instead of using migrations.
    Base.metadata.create_all(bind=engine)
    add_missing_columns()
    with SessionLocal() as db:
        seed_database(db)
        refresh_sample_meetings(db)
        ensure_demo_password(db)
        seed_team_chat(db)
        keep_sample_chats_private(db)
        seed_docs(db)
    yield


app = FastAPI(title="Zoom Clone API", version="1.0.0", lifespan=lifespan)

# CORS lets the frontend (on a different domain) call this API from the browser.
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ServiceError)
async def handle_service_error(_request: Request, exc: ServiceError):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})


app.include_router(auth.router)
app.include_router(users.router)
app.include_router(meetings.router)
app.include_router(participants.router)
app.include_router(team_chat.router)
app.include_router(documents.router)
app.include_router(notifications.router)


@app.get("/api/health", tags=["health"])
def health():
    return {"status": "ok"}
