from datetime import datetime
from uuid import UUID

from asyncpg import Connection
from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import CurrentUser, get_current_user
from core.database import get_db
from models.schemas import ApiResponse, SessionEndRequest, SessionResponse, SessionStartRequest

router = APIRouter()


@router.post("/start", response_model=ApiResponse[SessionResponse], status_code=201)
async def start_session(
    payload: SessionStartRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    row = await db.fetchrow(
        """
        INSERT INTO study_sessions (user_id, topic_id, session_type)
        VALUES ($1, $2, $3) RETURNING *
        """,
        user.id, payload.topic_id, payload.session_type,
    )
    return ApiResponse.ok(dict(row))


@router.post("/{session_id}/end", response_model=ApiResponse[SessionResponse])
async def end_session(
    session_id: UUID,
    payload: SessionEndRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    session = await db.fetchrow(
        "SELECT * FROM study_sessions WHERE id = $1 AND user_id = $2",
        session_id, user.id,
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    now = datetime.utcnow()
    duration = int((now - session["start_time"].replace(tzinfo=None)).total_seconds() / 60)

    updated = await db.fetchrow(
        """
        UPDATE study_sessions SET
            end_time = $2, duration_minutes = $3, quality_score = $4
        WHERE id = $1 RETURNING *
        """,
        session_id, now, duration, payload.quality_score,
    )
    return ApiResponse.ok(dict(updated))
