from uuid import UUID

from asyncpg import Connection
from fastapi import APIRouter, Depends, HTTPException, status

from core.algorithms import _readiness
from core.auth import CurrentUser, get_current_user
from core.database import get_db
from models.schemas import ApiResponse, ExamCreate, ExamResponse, ReadinessResponse

router = APIRouter()


@router.get("", response_model=ApiResponse[list[ExamResponse]])
async def list_exams(
    user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    rows = await db.fetch(
        "SELECT * FROM exams WHERE user_id = $1 ORDER BY exam_date",
        user.id,
    )
    return ApiResponse.ok([dict(r) for r in rows])


@router.post("", response_model=ApiResponse[ExamResponse], status_code=status.HTTP_201_CREATED)
async def create_exam(
    payload: ExamCreate,
    user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    async with db.transaction():
        exam = await db.fetchrow(
            """
            INSERT INTO exams (user_id, module, exam_name, exam_date)
            VALUES ($1, $2, $3, $4) RETURNING *
            """,
            user.id, payload.module, payload.exam_name, payload.exam_date,
        )
        for topic_id in payload.topic_ids:
            await db.execute(
                "INSERT INTO exam_topics (exam_id, topic_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
                exam["id"], topic_id,
            )
    return ApiResponse.ok(dict(exam))


@router.get("/{exam_id}/readiness", response_model=ApiResponse[ReadinessResponse])
async def get_readiness_score(
    exam_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    exam = await db.fetchrow(
        "SELECT * FROM exams WHERE id = $1 AND user_id = $2", exam_id, user.id
    )
    if not exam:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found")

    topic_rows = await db.fetch(
        """
        SELECT t.*, AVG(qh.score_percent) AS avg_quiz
        FROM topics t
        JOIN exam_topics et ON et.topic_id = t.id
        LEFT JOIN quiz_history qh ON qh.topic_id = t.id
        WHERE et.exam_id = $1
        GROUP BY t.id
        """,
        exam_id,
    )

    score, problems = _readiness([dict(r) for r in topic_rows], exam["exam_date"])
    return ApiResponse.ok(
        ReadinessResponse(exam=dict(exam), readiness_score=score, problems=problems)
    )


@router.delete("/{exam_id}", response_model=ApiResponse[None])
async def delete_exam(
    exam_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    result = await db.execute(
        "DELETE FROM exams WHERE id = $1 AND user_id = $2", exam_id, user.id
    )
    if result == "DELETE 0":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found")
    return ApiResponse.ok(None)
