from asyncpg import Connection
from fastapi import APIRouter, Depends

from core.algorithms import LOAD_PER_EVENT, MAX_DAILY_LOAD
from core.auth import CurrentUser, get_current_user
from core.database import get_db
from models.schemas import ApiResponse, LearningQueueResponse, QueueItemResponse, TopicResponse

router = APIRouter()


@router.get("", response_model=ApiResponse[LearningQueueResponse])
async def get_learning_queue(
    user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    load_today = await db.fetchval(
        "SELECT COALESCE(load_points, 0) FROM cognitive_load WHERE user_id = $1 AND date = CURRENT_DATE",
        user.id,
    ) or 0

    remaining_capacity = MAX_DAILY_LOAD - load_today
    max_items = max(0, remaining_capacity // LOAD_PER_EVENT)

    rows = await db.fetch(
        """
        SELECT *,
               (CURRENT_DATE - next_review_due)::int AS overdue_days
        FROM topics
        WHERE user_id = $1 AND next_review_due <= CURRENT_DATE
        ORDER BY (CURRENT_DATE - next_review_due) * 2 + (5 - understanding_score) DESC
        """,
        user.id,
    )

    total_due = len(rows)
    items: list[QueueItemResponse] = []
    for row in rows[:max_items]:
        d = dict(row)
        overdue_days = int(d.pop("overdue_days"))
        priority = float(overdue_days * 2 + (5 - d["understanding_score"]))
        items.append(
            QueueItemResponse(
                topic=TopicResponse(**d),
                overdue_days=overdue_days,
                priority=priority,
            )
        )

    return ApiResponse.ok(
        LearningQueueResponse(
            items=items,
            total_due=total_due,
            cognitive_load_today=load_today,
        )
    )


@router.get("/plan", response_model=ApiResponse[list])
async def plan_week(
    user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    """Phase 2: generate a 7-day study plan."""
    return ApiResponse.ok([])
