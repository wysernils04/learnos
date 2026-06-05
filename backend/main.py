from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from core.config import settings
from core.database import close_pool, init_pool
from core.storage import ensure_bucket
from routers import analytics, exams, files, flashcards, notes, queue, quiz, sessions, sbb, topics
from routers import settings as settings_router

limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_pool()
    ensure_bucket()
    yield
    await close_pool()


app = FastAPI(
    title="LearnOS API",
    version="0.1.0",
    description="Spaced-repetition learning backend — SuperMemo-2 + semantic search",
    lifespan=lifespan,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ──────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Uniform { data, error } error envelope ────────────────────────────────────

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"data": None, "error": exc.detail},
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    # Starlette 0.27+ re-raises unhandled exceptions past ExceptionMiddleware, so
    # CORSMiddleware never sees the response. Add CORS headers manually here.
    origin = request.headers.get("origin", "")
    cors_headers: dict[str, str] = {}
    if origin and origin in settings.cors_origins_list:
        cors_headers = {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Vary": "Origin",
        }
    return JSONResponse(
        status_code=500,
        content={"data": None, "error": "Internal server error"},
        headers=cors_headers,
    )


# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/health", tags=["meta"])
async def health() -> dict:
    return {"data": {"status": "ok", "version": "0.1.0"}, "error": None}


# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(topics.router,     prefix="/topics",     tags=["topics"])
app.include_router(queue.router,      prefix="/queue",      tags=["queue"])
app.include_router(flashcards.router, prefix="/flashcards", tags=["flashcards"])
app.include_router(exams.router,      prefix="/exams",      tags=["exams"])
app.include_router(quiz.router,       prefix="/quiz",       tags=["quiz"])
app.include_router(files.router,      prefix="/files",      tags=["files"])
app.include_router(sessions.router,   prefix="/sessions",   tags=["sessions"])
app.include_router(settings_router.router, prefix="/settings", tags=["settings"])
app.include_router(analytics.router,  prefix="/analytics",  tags=["analytics"])
app.include_router(notes.router,      prefix="/notes",      tags=["notes"])
app.include_router(sbb.router,        prefix="/sbb",        tags=["sbb"])
