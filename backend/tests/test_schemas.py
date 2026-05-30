"""
Pydantic v2 schema validation tests.
Verifies shapes, constraints, and the ApiResponse envelope.
"""
from datetime import date, datetime
from uuid import uuid4

import pytest
from pydantic import ValidationError

from models.schemas import (
    ApiResponse,
    ExamCreate,
    FlashcardCreate,
    FlashcardReviewRequest,
    ReviewRequest,
    SessionStartRequest,
    TopicCreate,
    TopicUpdate,
)


# ── ApiResponse envelope ─────────────────────────────────────────────────────

class TestApiResponse:
    def test_ok_sets_data(self):
        r = ApiResponse.ok({"key": "value"})
        assert r.data == {"key": "value"}
        assert r.error is None

    def test_fail_sets_error(self):
        r = ApiResponse.fail("something went wrong")
        assert r.data is None
        assert r.error == "something went wrong"

    def test_ok_with_list(self):
        r = ApiResponse.ok([1, 2, 3])
        assert r.data == [1, 2, 3]

    def test_ok_with_none(self):
        r = ApiResponse.ok(None)
        assert r.data is None
        assert r.error is None


# ── TopicCreate ───────────────────────────────────────────────────────────────

class TestTopicCreate:
    def test_valid_minimal(self):
        t = TopicCreate(name="Linear Algebra", module="Maths")
        assert t.understanding_score == 3  # default
        assert t.prerequisite_topic_id is None

    def test_understanding_score_bounds(self):
        TopicCreate(name="x", module="y", understanding_score=1)
        TopicCreate(name="x", module="y", understanding_score=5)
        with pytest.raises(ValidationError):
            TopicCreate(name="x", module="y", understanding_score=0)
        with pytest.raises(ValidationError):
            TopicCreate(name="x", module="y", understanding_score=6)

    def test_empty_name_rejected(self):
        with pytest.raises(ValidationError):
            TopicCreate(name="", module="Maths")

    def test_prerequisite_accepts_uuid(self):
        uid = uuid4()
        t = TopicCreate(name="x", module="y", prerequisite_topic_id=uid)
        assert t.prerequisite_topic_id == uid


# ── TopicUpdate ───────────────────────────────────────────────────────────────

class TestTopicUpdate:
    def test_all_fields_optional(self):
        t = TopicUpdate()
        assert t.name is None
        assert t.module is None
        assert t.understanding_score is None

    def test_partial_update(self):
        t = TopicUpdate(name="New Name")
        assert t.name == "New Name"
        assert t.module is None


# ── ReviewRequest ─────────────────────────────────────────────────────────────

class TestReviewRequest:
    @pytest.mark.parametrize("q", [0, 1, 2, 3, 4, 5])
    def test_valid_quality(self, q):
        ReviewRequest(quality=q)

    def test_quality_above_5_rejected(self):
        with pytest.raises(ValidationError):
            ReviewRequest(quality=6)

    def test_quality_below_0_rejected(self):
        with pytest.raises(ValidationError):
            ReviewRequest(quality=-1)


# ── FlashcardCreate ───────────────────────────────────────────────────────────

class TestFlashcardCreate:
    def test_valid(self):
        fc = FlashcardCreate(
            topic_id=uuid4(),
            question="What is entropy?",
            answer="A measure of disorder.",
        )
        assert fc.source == "manual"

    def test_empty_question_rejected(self):
        with pytest.raises(ValidationError):
            FlashcardCreate(topic_id=uuid4(), question="", answer="answer")


# ── ExamCreate ────────────────────────────────────────────────────────────────

class TestExamCreate:
    def test_valid_with_topics(self):
        ids = [uuid4(), uuid4()]
        e = ExamCreate(
            module="Physics",
            exam_name="Final Exam",
            exam_date=date(2026, 1, 15),
            topic_ids=ids,
        )
        assert len(e.topic_ids) == 2

    def test_no_topics_defaults_empty(self):
        e = ExamCreate(module="x", exam_name="y", exam_date=date(2026, 6, 1))
        assert e.topic_ids == []


# ── SessionStartRequest ───────────────────────────────────────────────────────

class TestSessionStartRequest:
    @pytest.mark.parametrize("stype", ["review", "quiz", "flashcard", "reading", "free"])
    def test_valid_session_types(self, stype):
        SessionStartRequest(session_type=stype)

    def test_invalid_session_type_rejected(self):
        with pytest.raises(ValidationError):
            SessionStartRequest(session_type="unknown")
