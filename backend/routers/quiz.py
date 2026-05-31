import json

from asyncpg import Connection
from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import CurrentUser, get_current_user
from core.database import get_db
from models.schemas import ApiResponse, GenerateQuizRequest, QuizQuestion, QuizResultRequest
from services.llm import generate_quiz_questions

router = APIRouter()


@router.post("/generate", response_model=ApiResponse[list[QuizQuestion]])
async def generate_quiz(
    payload: GenerateQuizRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    settings_row = await db.fetchrow(
        "SELECT anthropic_api_key_encrypted FROM user_settings WHERE user_id = $1", user.id
    )
    if not settings_row or not settings_row["anthropic_api_key_encrypted"]:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Add your Anthropic API key in Settings to generate quizzes.",
        )

    topic = await db.fetchrow(
        "SELECT * FROM topics WHERE id = $1 AND user_id = $2", payload.topic_id, user.id
    )
    if not topic:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")

    chunk_rows = await db.fetch(
        """
        SELECT fc.chunk_text FROM file_chunks fc
        JOIN files f ON f.id = fc.file_id
        WHERE f.user_id = $1 AND f.topic_id = $2 AND fc.chunk_text IS NOT NULL
        ORDER BY fc.chunk_index
        LIMIT 8
        """,
        user.id, payload.topic_id,
    )
    context = (
        "\n\n".join(r["chunk_text"] for r in chunk_rows)
        if chunk_rows
        else f"Topic: {topic['name']} (module: {topic['module']})"
    )

    try:
        raw_questions = await generate_quiz_questions(
            encrypted_api_key=settings_row["anthropic_api_key_encrypted"],
            topic_name=topic["name"],
            topic_context=context,
            num_questions=payload.num_questions,
            question_types=payload.question_types,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Quiz generation failed: {str(e)}")

    saved = []
    for q in raw_questions:
        options_json = json.dumps(q.get("options")) if q.get("options") else None
        row = await db.fetchrow(
            """
            INSERT INTO generated_quizzes
                (user_id, topic_id, question, answer, question_type, options)
            VALUES ($1, $2, $3, $4, $5, $6::jsonb)
            RETURNING *
            """,
            user.id, str(payload.topic_id),
            q["question"], q["answer"], q["question_type"], options_json,
        )
        saved.append(dict(row))

    return ApiResponse.ok(saved)


@router.get("/{topic_id}", response_model=ApiResponse[list[QuizQuestion]])
async def get_saved_quizzes(
    topic_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    rows = await db.fetch(
        "SELECT * FROM generated_quizzes WHERE user_id = $1 AND topic_id = $2 ORDER BY created_at DESC LIMIT 20",
        user.id, topic_id,
    )
    return ApiResponse.ok([dict(r) for r in rows])


@router.post("/result", response_model=ApiResponse[None])
async def submit_quiz_result(
    payload: QuizResultRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await db.execute(
        "INSERT INTO quiz_history (user_id, topic_id, score_percent) VALUES ($1, $2, $3)",
        user.id, payload.topic_id, payload.score_percent,
    )
    return ApiResponse.ok(None)
