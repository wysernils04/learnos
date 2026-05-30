from asyncpg import Connection
from fastapi import APIRouter, Depends

from core.auth import CurrentUser, get_current_user
from core.database import get_db
from models.schemas import ApiResponse, GenerateQuizRequest, QuizQuestion, QuizResultRequest

router = APIRouter()


@router.post("/generate", response_model=ApiResponse[list[QuizQuestion]])
async def generate_quiz(
    payload: GenerateQuizRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    """Phase 3: call LLM service to generate quiz questions for topic."""
    return ApiResponse.ok([])


@router.get("/{topic_id}", response_model=ApiResponse[list[QuizQuestion]])
async def get_saved_quizzes(
    topic_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    rows = await db.fetch(
        "SELECT * FROM generated_quizzes WHERE user_id = $1 AND topic_id = $2",
        user.id, topic_id,
    )
    return ApiResponse.ok([dict(r) for r in rows])


@router.post("/result", response_model=ApiResponse[None])
async def submit_quiz_result(
    payload: QuizResultRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    """Record a quiz attempt and update learning_streak."""
    await db.execute(
        "INSERT INTO quiz_history (user_id, topic_id, score_percent) VALUES ($1, $2, $3)",
        user.id, payload.topic_id, payload.score_percent,
    )
    return ApiResponse.ok(None)
