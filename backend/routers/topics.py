from datetime import date, datetime, timedelta
from uuid import UUID

from asyncpg import Connection
from fastapi import APIRouter, Depends, HTTPException, Query, status

from core.algorithms import _sm2, first_review_days
from core.auth import CurrentUser, get_current_user
from core.database import get_db
from models.schemas import (
    ApiResponse,
    ReviewRequest,
    ReviewResponse,
    TopicCreate,
    TopicResponse,
    TopicUpdate,
)

router = APIRouter()


# ── List / search ─────────────────────────────────────────────────────────────

@router.get("", response_model=ApiResponse[list[TopicResponse]])
async def list_topics(
    module: str | None = Query(None),
    user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    if module:
        rows = await db.fetch(
            "SELECT * FROM topics WHERE user_id = $1 AND module = $2 ORDER BY next_review_due",
            user.id, module,
        )
    else:
        rows = await db.fetch(
            "SELECT * FROM topics WHERE user_id = $1 ORDER BY next_review_due",
            user.id,
        )
    return ApiResponse.ok([dict(r) for r in rows])


@router.get("/search", response_model=ApiResponse[list[TopicResponse]])
async def search_topics(
    q: str = Query(..., min_length=1),
    user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    rows = await db.fetch(
        """
        SELECT * FROM topics
        WHERE user_id = $1
          AND (name ILIKE $2 OR module ILIKE $2)
        ORDER BY name
        LIMIT 50
        """,
        user.id, f"%{q}%",
    )
    return ApiResponse.ok([dict(r) for r in rows])


# ── Single topic ──────────────────────────────────────────────────────────────

@router.get("/{topic_id}", response_model=ApiResponse[TopicResponse])
async def get_topic(
    topic_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    row = await db.fetchrow(
        "SELECT * FROM topics WHERE id = $1 AND user_id = $2",
        topic_id, user.id,
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")
    return ApiResponse.ok(dict(row))


# ── Create (log_lecture) ──────────────────────────────────────────────────────

@router.post("", response_model=ApiResponse[TopicResponse], status_code=status.HTTP_201_CREATED)
async def log_lecture(
    payload: TopicCreate,
    user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    days = first_review_days(payload.understanding_score)
    next_due = date.today() + timedelta(days=days)
    memory_strength = float(payload.understanding_score) * 2.0

    row = await db.fetchrow(
        """
        INSERT INTO topics
            (user_id, name, module, understanding_score,
             memory_strength, next_review_due, prerequisite_topic_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        """,
        user.id, payload.name, payload.module,
        payload.understanding_score, memory_strength,
        next_due, payload.prerequisite_topic_id,
    )
    return ApiResponse.ok(dict(row))


# ── Update ────────────────────────────────────────────────────────────────────

@router.put("/{topic_id}", response_model=ApiResponse[TopicResponse])
async def update_topic(
    topic_id: UUID,
    payload: TopicUpdate,
    user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    existing = await db.fetchrow(
        "SELECT * FROM topics WHERE id = $1 AND user_id = $2",
        topic_id, user.id,
    )
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")

    updates = payload.model_dump(exclude_none=True)
    if not updates:
        return ApiResponse.ok(dict(existing))

    set_clauses = ", ".join(f"{k} = ${i + 2}" for i, k in enumerate(updates))
    values = list(updates.values())

    row = await db.fetchrow(
        f"UPDATE topics SET {set_clauses}, updated_at = NOW() WHERE id = $1 RETURNING *",
        topic_id, *values,
    )
    return ApiResponse.ok(dict(row))


# ── Delete ────────────────────────────────────────────────────────────────────

@router.delete("/{topic_id}", response_model=ApiResponse[None])
async def delete_topic(
    topic_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    result = await db.execute(
        "DELETE FROM topics WHERE id = $1 AND user_id = $2",
        topic_id, user.id,
    )
    if result == "DELETE 0":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")
    return ApiResponse.ok(None)


# ── SM-2 Review ───────────────────────────────────────────────────────────────

@router.post("/{topic_id}/review", response_model=ApiResponse[ReviewResponse])
async def review_topic(
    topic_id: UUID,
    payload: ReviewRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    topic = await db.fetchrow(
        "SELECT * FROM topics WHERE id = $1 AND user_id = $2",
        topic_id, user.id,
    )
    if not topic:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")

    new_ef, new_interval, new_reps = _sm2(
        topic["easiness_factor"],
        topic["sm2_interval"],
        topic["sm2_repetitions"],
        payload.quality,
    )
    next_due = date.today() + timedelta(days=new_interval)

    updated = await db.fetchrow(
        """
        UPDATE topics SET
            easiness_factor  = $2,
            sm2_interval     = $3,
            sm2_repetitions  = $4,
            last_reviewed    = NOW(),
            next_review_due  = $5,
            updated_at       = NOW()
        WHERE id = $1
        RETURNING *
        """,
        topic_id, new_ef, new_interval, new_reps, next_due,
    )

    # Upsert today's streak
    await db.execute(
        """
        INSERT INTO learning_streak (user_id, date, topics_reviewed)
        VALUES ($1, CURRENT_DATE, 1)
        ON CONFLICT (user_id, date)
        DO UPDATE SET topics_reviewed = learning_streak.topics_reviewed + 1
        """,
        user.id,
    )

    return ApiResponse.ok(
        ReviewResponse(
            topic=dict(updated),
            next_review_due=next_due,
            interval_days=new_interval,
        )
    )
