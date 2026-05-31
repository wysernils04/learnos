from datetime import date, timedelta

from asyncpg import Connection
from fastapi import APIRouter, Depends

from core.algorithms import _readiness
from core.auth import CurrentUser, get_current_user
from core.database import get_db
from models.schemas import ApiResponse, DashboardResponse, ExamResponse, StreakDay

router = APIRouter()


@router.get("/dashboard", response_model=ApiResponse[DashboardResponse])
async def get_dashboard(
    user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    due_today, due_flashcards, total_topics, study_today, study_7d_avg = await _fetch_counts(db, user.id)
    streak = await _compute_streak(db, user.id)
    next_exam, readiness_score = await _fetch_exam_readiness(db, user.id)

    return ApiResponse.ok(
        DashboardResponse(
            due_today=due_today,
            due_flashcards=due_flashcards,
            current_streak=streak,
            total_topics=total_topics,
            study_time_today_minutes=study_today,
            study_time_7d_avg_minutes=study_7d_avg,
            next_exam=next_exam,
            readiness_score=readiness_score,
        )
    )


async def _fetch_counts(db: Connection, user_id) -> tuple[int, int, int, int, float]:
    due_today = await db.fetchval(
        "SELECT COUNT(*) FROM topics WHERE user_id = $1 AND next_review_due <= CURRENT_DATE",
        user_id,
    ) or 0
    due_flashcards = await db.fetchval(
        "SELECT COUNT(*) FROM flashcards WHERE user_id = $1 AND next_review <= CURRENT_DATE",
        user_id,
    ) or 0
    total_topics = await db.fetchval(
        "SELECT COUNT(*) FROM topics WHERE user_id = $1", user_id
    ) or 0
    study_today = await db.fetchval(
        """
        SELECT COALESCE(SUM(duration_minutes), 0)
        FROM study_sessions
        WHERE user_id = $1 AND start_time::date = CURRENT_DATE AND duration_minutes IS NOT NULL
        """,
        user_id,
    ) or 0
    study_7d_avg = await db.fetchval(
        """
        SELECT COALESCE(AVG(daily_total), 0.0)::float
        FROM (
            SELECT SUM(duration_minutes) AS daily_total
            FROM study_sessions
            WHERE user_id = $1
              AND start_time >= CURRENT_DATE - INTERVAL '6 days'
              AND duration_minutes IS NOT NULL
            GROUP BY start_time::date
        ) t
        """,
        user_id,
    ) or 0.0
    return int(due_today), int(due_flashcards), int(total_topics), int(study_today), float(study_7d_avg)


async def _compute_streak(db: Connection, user_id) -> int:
    rows = await db.fetch(
        """
        SELECT date FROM learning_streak
        WHERE user_id = $1 AND topics_reviewed > 0
        ORDER BY date DESC
        LIMIT 366
        """,
        user_id,
    )
    streak_dates = {r["date"] for r in rows}
    today = date.today()
    check = today if today in streak_dates else today - timedelta(days=1)
    streak = 0
    while check in streak_dates:
        streak += 1
        check -= timedelta(days=1)
    return streak


async def _fetch_exam_readiness(
    db: Connection, user_id
) -> tuple[ExamResponse | None, int | None]:
    exam_row = await db.fetchrow(
        """
        SELECT * FROM exams
        WHERE user_id = $1 AND exam_date >= CURRENT_DATE
        ORDER BY exam_date ASC
        LIMIT 1
        """,
        user_id,
    )
    if not exam_row:
        return None, None

    topic_rows = await db.fetch(
        """
        SELECT t.*,
               COALESCE(AVG(qh.score_percent), 0)::float AS avg_quiz
        FROM exam_topics et
        JOIN topics t ON t.id = et.topic_id
        LEFT JOIN quiz_history qh ON qh.topic_id = t.id
        WHERE et.exam_id = $1
        GROUP BY t.id, t.user_id, t.name, t.module, t.understanding_score,
                 t.memory_strength, t.easiness_factor, t.sm2_interval,
                 t.sm2_repetitions, t.last_reviewed, t.next_review_due,
                 t.prerequisite_topic_id, t.created_at, t.updated_at
        """,
        exam_row["id"],
    )
    readiness, _ = _readiness([dict(r) for r in topic_rows], exam_row["exam_date"])
    return ExamResponse(**dict(exam_row)), readiness


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


@router.get("/quiz-history", response_model=ApiResponse[list])
async def get_quiz_history(
    user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    rows = await db.fetch(
        """
        SELECT date::date AS date, ROUND(AVG(score_percent))::int AS avg_score, COUNT(*) AS count
        FROM quiz_history
        WHERE user_id = $1 AND date >= CURRENT_DATE - INTERVAL '29 days'
        GROUP BY date::date
        ORDER BY date::date
        """,
        user.id,
    )
    return ApiResponse.ok([dict(r) for r in rows])


@router.get("/topics-due", response_model=ApiResponse[list])
async def get_topics_due_breakdown(
    user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    rows = await db.fetch(
        """
        SELECT
            CASE
                WHEN next_review_due < CURRENT_DATE THEN 'Overdue'
                WHEN next_review_due = CURRENT_DATE THEN 'Today'
                WHEN next_review_due <= CURRENT_DATE + 3 THEN 'This week'
                WHEN next_review_due <= CURRENT_DATE + 7 THEN 'Next week'
                ELSE 'Later'
            END AS bucket,
            COUNT(*) AS count
        FROM topics
        WHERE user_id = $1
        GROUP BY bucket
        ORDER BY MIN(next_review_due)
        """,
        user.id,
    )
    return ApiResponse.ok([dict(r) for r in rows])
