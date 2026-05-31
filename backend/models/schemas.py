"""
Pydantic v2 schemas for all API endpoints.
All responses are wrapped in ApiResponse[T]: { data, error }.
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Any, Generic, Optional, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


# ── Shared ────────────────────────────────────────────────────────────────────

class ApiResponse(BaseModel, Generic[T]):
    data: Optional[T] = None
    error: Optional[str] = None

    @classmethod
    def ok(cls, data: T) -> "ApiResponse[T]":
        return cls(data=data)

    @classmethod
    def fail(cls, error: str) -> "ApiResponse[None]":
        return cls(data=None, error=error)


# ── Topics ────────────────────────────────────────────────────────────────────

class TopicCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    module: str = Field(..., min_length=1, max_length=255)
    understanding_score: int = Field(3, ge=1, le=5)
    prerequisite_topic_id: Optional[UUID] = None


class TopicUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    module: Optional[str] = Field(None, min_length=1, max_length=255)
    understanding_score: Optional[int] = Field(None, ge=1, le=5)
    prerequisite_topic_id: Optional[UUID] = None


class TopicResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    module: str
    understanding_score: int
    memory_strength: float
    easiness_factor: float
    sm2_interval: int
    sm2_repetitions: int
    last_reviewed: Optional[datetime]
    next_review_due: date
    prerequisite_topic_id: Optional[UUID]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReviewRequest(BaseModel):
    quality: int = Field(..., ge=0, le=5)


class ReviewResponse(BaseModel):
    topic: TopicResponse
    next_review_due: date
    interval_days: int


# ── Learning Queue ────────────────────────────────────────────────────────────

class QueueItemResponse(BaseModel):
    topic: TopicResponse
    overdue_days: int
    priority: float


class LearningQueueResponse(BaseModel):
    items: list[QueueItemResponse]
    total_due: int
    cognitive_load_today: int


# ── Flashcards ────────────────────────────────────────────────────────────────

class FlashcardCreate(BaseModel):
    topic_id: UUID
    question: str = Field(..., min_length=1)
    answer: str = Field(..., min_length=1)
    source: Optional[str] = "manual"


class FlashcardUpdate(BaseModel):
    question: Optional[str] = None
    answer: Optional[str] = None


class FlashcardResponse(BaseModel):
    id: UUID
    user_id: UUID
    topic_id: UUID
    question: str
    answer: str
    source: Optional[str]
    easiness_factor: float
    sm2_interval: int
    sm2_repetitions: int
    next_review: date
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FlashcardReviewRequest(BaseModel):
    quality: int = Field(..., ge=0, le=5)


# ── Exams ─────────────────────────────────────────────────────────────────────

class ExamCreate(BaseModel):
    module: str = Field(..., min_length=1)
    exam_name: str = Field(..., min_length=1)
    exam_date: date
    topic_ids: list[UUID] = Field(default_factory=list)


class ExamResponse(BaseModel):
    id: UUID
    user_id: UUID
    module: str
    exam_name: str
    exam_date: date
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReadinessResponse(BaseModel):
    exam: ExamResponse
    readiness_score: int
    problems: list[str]


# ── Quiz ──────────────────────────────────────────────────────────────────────

class GenerateQuizRequest(BaseModel):
    topic_id: UUID
    num_questions: int = Field(5, ge=1, le=20)
    question_types: list[str] = Field(
        default_factory=lambda: ["multiple_choice", "true_false"]
    )


class QuizOption(BaseModel):
    label: str
    text: str


class QuizQuestion(BaseModel):
    id: UUID
    question: str
    answer: str
    question_type: str
    options: Optional[list[QuizOption]]


class QuizResultRequest(BaseModel):
    topic_id: UUID
    score_percent: int = Field(..., ge=0, le=100)


# ── Files ─────────────────────────────────────────────────────────────────────

class FileResponse(BaseModel):
    id: UUID
    user_id: UUID
    topic_id: Optional[UUID]
    filename: str
    file_path: str
    file_type: str
    page_count: Optional[int]
    chunk_count: int
    sha256: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SemanticSearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    limit: int = Field(5, ge=1, le=20)
    similarity_threshold: float = Field(0.5, ge=0.0, le=1.0)
    topic_id: Optional[UUID] = None


class SearchResultItem(BaseModel):
    chunk_id: UUID
    file_id: UUID
    chunk_text: str
    page_number: Optional[int]
    similarity: float
    filename: str
    topic_id: Optional[UUID]


# ── Study Sessions ────────────────────────────────────────────────────────────

class SessionStartRequest(BaseModel):
    topic_id: Optional[UUID] = None
    session_type: str = Field(
        ..., pattern="^(review|quiz|flashcard|reading|free)$"
    )


class SessionEndRequest(BaseModel):
    quality_score: Optional[int] = Field(None, ge=0, le=5)


class SessionResponse(BaseModel):
    id: UUID
    user_id: UUID
    topic_id: Optional[UUID]
    start_time: datetime
    end_time: Optional[datetime]
    duration_minutes: Optional[int]
    quality_score: Optional[int]
    session_type: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Analytics ─────────────────────────────────────────────────────────────────

class StreakDay(BaseModel):
    date: date
    topics_reviewed: int


class DashboardResponse(BaseModel):
    due_today: int
    due_flashcards: int
    current_streak: int
    total_topics: int
    study_time_today_minutes: int
    study_time_7d_avg_minutes: float
    next_exam: Optional[ExamResponse]
    readiness_score: Optional[int]


# ── Notes ─────────────────────────────────────────────────────────────────────

class NoteCreate(BaseModel):
    topic_id: UUID
    content: str = Field(..., min_length=1, max_length=10_000)


class NoteUpdate(BaseModel):
    content: str = Field(..., min_length=1, max_length=10_000)


class NoteResponse(BaseModel):
    id: UUID
    user_id: UUID
    topic_id: UUID
    content: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── User Settings ─────────────────────────────────────────────────────────────

class ApiKeyRequest(BaseModel):
    anthropic_api_key: str = Field(..., min_length=10)


class ApiKeyResponse(BaseModel):
    has_key: bool
