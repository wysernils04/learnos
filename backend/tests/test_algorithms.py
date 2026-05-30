"""
Pure algorithm tests — no DB, no network, no env vars.
Verifies SM-2, readiness, Ebbinghaus, chunking are correct.
"""
from datetime import date, timedelta

import pytest

from core.algorithms import (
    MAX_DAILY_LOAD,
    LOAD_PER_EVENT,
    _chunk_text,
    _readiness,
    _sm2,
    first_review_days,
    score_to_quality,
)


# ── SM-2 ─────────────────────────────────────────────────────────────────────

class TestSM2:
    def test_quality_below_3_resets(self):
        ef, interval, reps = _sm2(2.5, 10, 5, 2)
        assert reps == 0
        assert interval == 1

    def test_first_rep_sets_interval_1(self):
        ef, interval, reps = _sm2(2.5, 1, 0, 4)
        assert interval == 1
        assert reps == 1

    def test_second_rep_sets_interval_6(self):
        ef, interval, reps = _sm2(2.5, 1, 1, 4)
        assert interval == 6
        assert reps == 2

    def test_third_rep_multiplies_by_ef(self):
        ef, interval, reps = _sm2(2.5, 6, 2, 5)
        assert interval == 15   # round(6 * 2.5)
        assert reps == 3

    def test_ef_increases_on_perfect(self):
        ef_before = 2.5
        ef, _, _ = _sm2(ef_before, 1, 0, 5)
        assert ef > ef_before

    def test_ef_decreases_on_hard(self):
        ef_before = 2.5
        ef, _, _ = _sm2(ef_before, 1, 0, 3)
        assert ef < ef_before

    def test_ef_floor_is_1_3(self):
        ef, _, _ = _sm2(1.3, 1, 0, 0)
        assert ef >= 1.3

    def test_ef_rounded_to_3_decimal(self):
        ef, _, _ = _sm2(2.5, 1, 0, 4)
        assert ef == round(ef, 3)

    def test_perfect_score_chain(self):
        ef, interval, reps = 2.5, 1, 0
        for q in [5, 5, 5]:
            ef, interval, reps = _sm2(ef, interval, reps, q)
        # After 3 perfect reviews: reps=3, interval = round(6 * ef_after_2nd)
        assert reps == 3
        assert interval > 6


# ── Score → Quality mapping ───────────────────────────────────────────────────

class TestScoreToQuality:
    @pytest.mark.parametrize("score,expected", [
        (0, 1), (39, 1),
        (40, 2), (54, 2),
        (55, 3), (69, 3),
        (70, 4), (84, 4),
        (85, 5), (100, 5),
    ])
    def test_mapping(self, score, expected):
        assert score_to_quality(score) == expected


# ── Ebbinghaus first review ───────────────────────────────────────────────────

class TestFirstReviewDays:
    def test_minimum_is_1(self):
        assert first_review_days(1) >= 1

    def test_higher_score_gives_more_days(self):
        assert first_review_days(5) > first_review_days(1)

    @pytest.mark.parametrize("score", [1, 2, 3, 4, 5])
    def test_always_positive(self, score):
        assert first_review_days(score) > 0


# ── Readiness score ───────────────────────────────────────────────────────────

class TestReadiness:
    def _topic(self, name="Math", understanding=4, avg_quiz=80, days_until_due=3):
        return {
            "name": name,
            "understanding_score": understanding,
            "avg_quiz": avg_quiz,
            "next_review_due": date.today() + timedelta(days=days_until_due),
        }

    def test_empty_topics_returns_zero(self):
        score, problems = _readiness([], date.today() + timedelta(days=7))
        assert score == 0
        assert problems

    def test_perfect_topic_near_max(self):
        topic = self._topic(understanding=5, avg_quiz=100, days_until_due=-1)  # overdue = reviewed
        score, _ = _readiness([topic], date.today() + timedelta(days=14))
        assert score >= 90

    def test_weak_topic_flags_problems(self):
        topic = self._topic(understanding=1, avg_quiz=20, days_until_due=30)
        score, problems = _readiness([topic], date.today() + timedelta(days=7))
        assert score < 50
        assert any("understanding" in p.lower() for p in problems)

    def test_score_capped_at_100(self):
        topics = [self._topic(understanding=5, avg_quiz=100, days_until_due=-1) for _ in range(5)]
        score, _ = _readiness(topics, date.today() + timedelta(days=30))
        assert score <= 100

    def test_score_never_negative(self):
        topics = [self._topic(understanding=1, avg_quiz=0, days_until_due=90)]
        score, _ = _readiness(topics, date.today() - timedelta(days=1))
        assert score >= 0


# ── Text chunking ─────────────────────────────────────────────────────────────

class TestChunkText:
    def test_short_text_single_chunk(self):
        text = " ".join(["word"] * 10)
        chunks = _chunk_text(text, chunk_size=500)
        assert len(chunks) == 1

    def test_long_text_multiple_chunks(self):
        text = " ".join([f"word{i}" for i in range(1100)])
        chunks = _chunk_text(text, chunk_size=500, overlap=50)
        assert len(chunks) > 1

    def test_overlap_means_shared_words(self):
        text = " ".join([f"w{i}" for i in range(600)])
        chunks = _chunk_text(text, chunk_size=500, overlap=50)
        # The last 50 words of chunk 0 should appear at the start of chunk 1
        last_words_chunk0 = set(chunks[0].split()[-50:])
        first_words_chunk1 = set(chunks[1].split()[:50])
        assert last_words_chunk0 & first_words_chunk1

    def test_no_empty_chunks(self):
        chunks = _chunk_text("  a  b  c  ")  # default chunk_size=500, overlap=50
        assert all(c.strip() for c in chunks)

    def test_empty_text_returns_empty(self):
        assert _chunk_text("") == []


# ── Cognitive load constants ───────────────────────────────────────────────────

def test_load_constants():
    assert LOAD_PER_EVENT == 60
    assert MAX_DAILY_LOAD == 300
    assert MAX_DAILY_LOAD // LOAD_PER_EVENT == 5  # max 5 events/day
