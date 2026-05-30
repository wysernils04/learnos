from asyncpg import Connection
from fastapi import APIRouter, Depends

from core.auth import CurrentUser, get_current_user
from core.database import get_db
from models.schemas import ApiResponse, DashboardResponse, StreakDay

router = APIRouter()


@router.get("/dashboard", response_model=ApiResponse[DashboardResponse])
async def get_dashboard(
    user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    """Phase 2: daily briefing — due counts, streak, next exam, readiness."""
    due_today = await db.fetchval(
        "SELECT COUNT(*) FROM topics WHERE user_id = $1 AND next_review_due <= CURRENT_DATE",
        user.id,
    )
    due_flashcards = await db.fetchval(
        "SELECT COUNT(*) FROM flashcards WHERE user_id = $1 AND next_review <= CURRENT_DATE",
        user.id,
    )
    total_topics = await db.fetchval(
        "SELECT COUNT(*) FROM topics WHERE user_id = $1", user.id
    )
    return ApiResponse.ok(
        DashboardResponse(
            due_today=due_today or 0,
            due_flashcards=due_flashcards or 0,
            current_streak=0,
            total_topics=total_topics or 0,
            study_time_today_minutes=0,
            study_time_7d_avg_minutes=0.0,
            next_exam=None,
            readiness_score=None,
        )
    )


@router.get("/streak", response_model=ApiResponse[list[StreakDay]])
async def get_streak(
    user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    rows = await db.fetch(
        "SELECT date, topics_reviewed FROM learning_streak WHERE user_id = $1 ORDER BY date DESC LIMIT 365",
        user.id,
    )
    return ApiResponse.ok([dict(r) for r in rows])


@router.get("/modules", response_model=ApiResponse[list])
async def get_module_stats(
    user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    rows = await db.fetch(
        """
        SELECT module,
               COUNT(*)                            AS topic_count,
               AVG(understanding_score)::float     AS avg_understanding,
               MIN(next_review_due)                AS next_due
        FROM topics
        WHERE user_id = $1
        GROUP BY module
        ORDER BY module
        """,
        user.id,
    )
    return ApiResponse.ok([dict(r) for r in rows])
