from uuid import UUID

from asyncpg import Connection
from fastapi import APIRouter, Depends, HTTPException

from core.auth import CurrentUser, get_current_user
from core.database import get_db
from models.schemas import ApiResponse, NoteCreate, NoteResponse, NoteUpdate

router = APIRouter()


@router.get("", response_model=ApiResponse[list[NoteResponse]])
async def list_notes(
    topic_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    rows = await db.fetch(
        "SELECT * FROM notes WHERE user_id = $1 AND topic_id = $2 ORDER BY created_at DESC",
        user.id, topic_id,
    )
    return ApiResponse.ok([dict(r) for r in rows])


@router.post("", response_model=ApiResponse[NoteResponse], status_code=201)
async def create_note(
    payload: NoteCreate,
    user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    row = await db.fetchrow(
        "INSERT INTO notes (user_id, topic_id, content) VALUES ($1, $2, $3) RETURNING *",
        user.id, payload.topic_id, payload.content,
    )
    return ApiResponse.ok(dict(row))


@router.put("/{note_id}", response_model=ApiResponse[NoteResponse])
async def update_note(
    note_id: UUID,
    payload: NoteUpdate,
    user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    row = await db.fetchrow(
        """
        UPDATE notes SET content = $3, updated_at = NOW()
        WHERE id = $1 AND user_id = $2 RETURNING *
        """,
        note_id, user.id, payload.content,
    )
    if not row:
        raise HTTPException(404, "Note not found")
    return ApiResponse.ok(dict(row))


@router.delete("/{note_id}", response_model=ApiResponse[None])
async def delete_note(
    note_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    deleted = await db.fetchval(
        "DELETE FROM notes WHERE id = $1 AND user_id = $2 RETURNING id",
        note_id, user.id,
    )
    if not deleted:
        raise HTTPException(404, "Note not found")
    return ApiResponse.ok(None)
