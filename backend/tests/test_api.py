"""
API endpoint tests — all DB calls and auth are mocked via conftest.py fixtures.
Tests: response shapes, status codes, SM-2 integration, streak upsert.
"""
from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, call
from uuid import uuid4

import pytest


# ── /health ───────────────────────────────────────────────────────────────────

def test_health_returns_ok(client):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["data"]["status"] == "ok"
    assert body["error"] is None


# ── /topics ───────────────────────────────────────────────────────────────────

class TestTopicsList:
    def test_empty_list(self, client, mock_db):
        mock_db.fetch.return_value = []
        r = client.get("/topics")
        assert r.status_code == 200
        assert r.json() == {"data": [], "error": None}

    def test_module_filter_passed_to_query(self, client, mock_db):
        mock_db.fetch.return_value = []
        client.get("/topics?module=Physics")
        args = mock_db.fetch.call_args[0]
        assert "Physics" in args


class TestTopicCreate:
    def _topic_row(self, topic_id=None):
        now = datetime.now(timezone.utc)
        return {
            "id": topic_id or uuid4(),
            "user_id": uuid4(),
            "name": "Calculus",
            "module": "Maths",
            "understanding_score": 4,
            "memory_strength": 8.0,
            "easiness_factor": 2.5,
            "sm2_interval": 1,
            "sm2_repetitions": 0,
            "last_reviewed": None,
            "next_review_due": date.today(),
            "prerequisite_topic_id": None,
            "created_at": now,
            "updated_at": now,
        }

    def test_create_returns_201(self, client, mock_db):
        mock_db.fetchrow.return_value = self._topic_row()
        r = client.post("/topics", json={"name": "Calculus", "module": "Maths", "understanding_score": 4})
        assert r.status_code == 201

    def test_response_has_data_key(self, client, mock_db):
        mock_db.fetchrow.return_value = self._topic_row()
        r = client.post("/topics", json={"name": "Calculus", "module": "Maths"})
        body = r.json()
        assert body["error"] is None
        assert body["data"]["name"] == "Calculus"

    def test_validation_error_on_bad_score(self, client):
        r = client.post("/topics", json={"name": "x", "module": "y", "understanding_score": 99})
        assert r.status_code == 422

    def test_missing_required_fields(self, client):
        r = client.post("/topics", json={"name": "Only Name"})
        assert r.status_code == 422


class TestTopicGet:
    def test_not_found_returns_404(self, client, mock_db):
        mock_db.fetchrow.return_value = None
        r = client.get(f"/topics/{uuid4()}")
        assert r.status_code == 404
        assert r.json()["error"] is not None

    def test_found_returns_200(self, client, mock_db):
        now = datetime.now(timezone.utc)
        mock_db.fetchrow.return_value = {
            "id": uuid4(), "user_id": uuid4(), "name": "Fourier",
            "module": "Signals", "understanding_score": 3,
            "memory_strength": 6.0, "easiness_factor": 2.5,
            "sm2_interval": 1, "sm2_repetitions": 0,
            "last_reviewed": None, "next_review_due": date.today(),
            "prerequisite_topic_id": None, "created_at": now, "updated_at": now,
        }
        r = client.get(f"/topics/{uuid4()}")
        assert r.status_code == 200
        assert r.json()["data"]["name"] == "Fourier"


class TestTopicDelete:
    def test_not_found_returns_404(self, client, mock_db):
        mock_db.execute.return_value = "DELETE 0"
        r = client.delete(f"/topics/{uuid4()}")
        assert r.status_code == 404

    def test_deleted_returns_200(self, client, mock_db):
        mock_db.execute.return_value = "DELETE 1"
        r = client.delete(f"/topics/{uuid4()}")
        assert r.status_code == 200
        assert r.json() == {"data": None, "error": None}


class TestTopicReview:
    def _topic_row(self):
        now = datetime.now(timezone.utc)
        return {
            "id": uuid4(), "user_id": uuid4(), "name": "SM2 Test",
            "module": "Test", "understanding_score": 3,
            "memory_strength": 6.0, "easiness_factor": 2.5,
            "sm2_interval": 6, "sm2_repetitions": 2,
            "last_reviewed": now, "next_review_due": date.today(),
            "prerequisite_topic_id": None, "created_at": now, "updated_at": now,
        }

    def test_quality_0_returns_200(self, client, mock_db):
        mock_db.fetchrow.side_effect = [self._topic_row(), self._topic_row()]
        r = client.post(f"/topics/{uuid4()}/review", json={"quality": 0})
        assert r.status_code == 200

    def test_quality_5_returns_200(self, client, mock_db):
        mock_db.fetchrow.side_effect = [self._topic_row(), self._topic_row()]
        r = client.post(f"/topics/{uuid4()}/review", json={"quality": 5})
        assert r.status_code == 200

    def test_review_response_has_next_due(self, client, mock_db):
        row = self._topic_row()
        mock_db.fetchrow.side_effect = [row, row]
        r = client.post(f"/topics/{uuid4()}/review", json={"quality": 4})
        body = r.json()
        assert body["error"] is None
        assert "next_review_due" in body["data"]
        assert "interval_days" in body["data"]

    def test_streak_upsert_called_after_review(self, client, mock_db):
        row = self._topic_row()
        mock_db.fetchrow.side_effect = [row, row]
        client.post(f"/topics/{uuid4()}/review", json={"quality": 3})
        # execute() should have been called for the streak upsert
        assert mock_db.execute.called
        upsert_call = str(mock_db.execute.call_args_list[-1])
        assert "learning_streak" in upsert_call

    def test_invalid_quality_rejected(self, client):
        r = client.post(f"/topics/{uuid4()}/review", json={"quality": 6})
        assert r.status_code == 422

    def test_topic_not_found_returns_404(self, client, mock_db):
        mock_db.fetchrow.return_value = None
        r = client.post(f"/topics/{uuid4()}/review", json={"quality": 4})
        assert r.status_code == 404


# ── /topics/search ────────────────────────────────────────────────────────────

def test_search_requires_q_param(client):
    r = client.get("/topics/search")
    assert r.status_code == 422


def test_search_passes_wildcard_query(client, mock_db):
    mock_db.fetch.return_value = []
    client.get("/topics/search?q=calculus")
    args = mock_db.fetch.call_args[0]
    assert "%calculus%" in args


# ── /analytics ────────────────────────────────────────────────────────────────

def test_dashboard_returns_counts(client, mock_db):
    # due_today, due_flashcards, total_topics, study_today, study_7d_avg
    mock_db.fetchval.side_effect = [5, 3, 12, 0, 0.0]
    mock_db.fetch.return_value = []      # no streak rows
    mock_db.fetchrow.return_value = None  # no upcoming exam
    r = client.get("/analytics/dashboard")
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["due_today"] == 5
    assert data["due_flashcards"] == 3
    assert data["total_topics"] == 12
    assert data["current_streak"] == 0
    assert data["readiness_score"] is None


def test_streak_returns_list(client, mock_db):
    mock_db.fetch.return_value = []
    r = client.get("/analytics/streak")
    assert r.status_code == 200
    assert r.json()["data"] == []


# ── /sessions ─────────────────────────────────────────────────────────────────

def test_start_session_returns_201(client, mock_db):
    now = datetime.now(timezone.utc)
    mock_db.fetchrow.return_value = {
        "id": uuid4(), "user_id": uuid4(), "topic_id": None,
        "start_time": now, "end_time": None, "duration_minutes": None,
        "quality_score": None, "session_type": "review", "created_at": now,
    }
    r = client.post("/sessions/start", json={"session_type": "review"})
    assert r.status_code == 201


def test_start_session_invalid_type(client):
    r = client.post("/sessions/start", json={"session_type": "nap"})
    assert r.status_code == 422


# ── /sbb ──────────────────────────────────────────────────────────────────────

def test_sbb_missing_params(client):
    r = client.get("/sbb/connections")
    assert r.status_code == 422


# ── /queue and /flashcards stubs ──────────────────────────────────────────────

def test_queue_returns_empty(client):
    r = client.get("/queue")
    assert r.status_code == 200
    assert r.json()["data"]["total_due"] == 0


def test_flashcards_list_returns_200(client, mock_db):
    mock_db.fetch.return_value = []
    r = client.get("/flashcards")
    assert r.status_code == 200
    assert r.json()["data"] == []
