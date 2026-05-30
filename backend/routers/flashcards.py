from uuid import UUID

from asyncpg import Connection
from fastapi import APIRouter, Depends, HTTPException, status

from core.algorithms import _sm2
from core.auth import CurrentUser, get_current_user
from core.database import get_db
from models.schemas import (
    ApiResponse,
    FlashcardCreate,
    FlashcardResponse,
    FlashcardReviewRequest,
    FlashcardUpdate,
)

router = APIRouter()


@router.get("", response_model=ApiResponse[list[FlashcardResponse]])
async def list_flashcards(
    user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    rows = await db.fetch(
        "SELECT * FROM flashcards WHERE user_id = $1 ORDER BY next_review",
        user.id,
    )
    return ApiResponse.ok([dict(r) for r in rows])


@router.get("/due", response_model=ApiResponse[list[FlashcardResponse]])
async def get_due_flashcards(
    user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    rows = await db.fetch(
        "SELECT * FROM flashcards WHERE user_id = $1 AND next_review <= CURRENT_DATE ORDER BY next_review",
        user.id,
    )
    return ApiResponse.ok([dict(r) for r in rows])


@router.post("", response_model=ApiResponse[FlashcardResponse], status_code=status.HTTP_201_CREATED)
async def create_flashcard(
    payload: FlashcardCreate,
    user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    row = await db.fetchrow(
        """
        INSERT INTO flashcards (user_id, topic_id, question, answer, source)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        """,
        user.id, payload.topic_id, payload.question, payload.answer, payload.source,
    )
    return ApiResponse.ok(dict(row))


@router.post("/{card_id}/review", response_model=ApiResponse[FlashcardResponse])
async def review_flashcard(
    card_id: UUID,
    payload: FlashcardReviewRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    from datetime import date, timedelta

    card = await db.fetchrow(
        "SELECT * FROM flashcards WHERE id = $1 AND user_id = $2",
        card_id, user.id,
    )
    if not card:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flashcard not found")

    new_ef, new_interval, new_reps = _sm2(
        card["easiness_factor"], card["sm2_interval"], card["sm2_repetitions"], payload.quality
    )
    next_review = date.today() + timedelta(days=new_interval)

    updated = await db.fetchrow(
        """
        UPDATE flashcards SET
            easiness_factor = $2, sm2_interval = $3,
            sm2_repetitions = $4, next_review = $5, updated_at = NOW()
        WHERE id = $1 RETURNING *
        """,
        card_id, new_ef, new_interval, new_reps, next_review,
    )
    return ApiResponse.ok(dict(updated))


@router.delete("/{card_id}", response_model=ApiResponse[None])
async def delete_flashcard(
    card_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    result = await db.execute(
        "DELETE FROM flashcards WHERE id = $1 AND user_id = $2", card_id, user.id
    )
    if result == "DELETE 0":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flashcard not found")
    return ApiResponse.ok(None)
