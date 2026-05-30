from asyncpg import Connection
from fastapi import APIRouter, Depends

from core.auth import CurrentUser, get_current_user
from core.database import get_db
from models.schemas import ApiResponse, LearningQueueResponse, QueueItemResponse

router = APIRouter()


@router.get("", response_model=ApiResponse[LearningQueueResponse])
async def get_learning_queue(
    user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    """
    Phase 2: return topics due today, ordered by overdue days + priority.
    Stub — returns empty queue.
    """
    return ApiResponse.ok(
        LearningQueueResponse(items=[], total_due=0, cognitive_load_today=0)
    )


@router.get("/plan", response_model=ApiResponse[list])
async def plan_week(
    user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    """Phase 2: generate a 7-day study plan."""
    return ApiResponse.ok([])
