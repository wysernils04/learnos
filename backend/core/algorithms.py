"""
Core learning algorithms — copy verbatim, do not alter.
Sources: SuperMemo-2 (Wozniak 1987), Ebbinghaus forgetting curve.
"""
import math
from datetime import date


# ── SuperMemo-2 ───────────────────────────────────────────────────────────────

def _sm2(ef: float, interval: int, reps: int, quality: int) -> tuple[float, int, int]:
    if quality < 3:
        reps, interval = 0, 1
    else:
        interval = 1 if reps == 0 else (6 if reps == 1 else round(interval * ef))
        reps += 1
    ef = max(1.3, ef + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    return round(ef, 3), interval, reps


# ── SM-2 quality ← score_percent mapping ─────────────────────────────────────
# < 40% → 1 | 40–55% → 2 | 55–70% → 3 | 70–85% → 4 | > 85% → 5

def score_to_quality(score_percent: int) -> int:
    if score_percent < 40:
        return 1
    if score_percent < 55:
        return 2
    if score_percent < 70:
        return 3
    if score_percent < 85:
        return 4
    return 5


# ── Ebbinghaus: first review interval ────────────────────────────────────────

def first_review_days(understanding_score: int) -> int:
    memory_strength = float(understanding_score) * 2.0
    return max(1, round(memory_strength * math.log(1 / 0.7)))


# ── Readiness score ───────────────────────────────────────────────────────────
# Weights: understanding 35% | quiz performance 40% | timing 25%

def _readiness(topic_rows: list[dict], exam_date: date) -> tuple[int, list[str]]:
    if not topic_rows:
        return 0, ["No topics linked to this exam"]

    total, problems = 0.0, []
    for row in topic_rows:
        score = row["understanding_score"]
        avg_quiz = row.get("avg_quiz") or 0
        next_due: date = row["next_review_due"]

        u_pts = (score / 5) * 35
        q_pts = (avg_quiz / 100) * 40
        t_pts = (
            25
            if next_due <= exam_date
            else max(0, 25 - (next_due - exam_date).days * 3)
        )
        total += u_pts + q_pts + t_pts

        if score <= 2:
            problems.append(f"Low understanding: {row['name']}")
        if avg_quiz < 60:
            problems.append(f"Poor quiz performance: {row['name']}")
        if next_due > exam_date:
            problems.append(f"Review not due before exam: {row['name']}")

    avg = round(total / len(topic_rows))
    return min(100, max(0, avg)), problems


# ── Text chunking for embeddings ──────────────────────────────────────────────

def _chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    words = text.split()
    chunks: list[str] = []
    step = max(1, chunk_size - overlap)  # guard: overlap must not exceed chunk_size
    i = 0
    while i < len(words):
        chunks.append(" ".join(words[i : i + chunk_size]))
        i += step
    return [c for c in chunks if c.strip()]


# ── Cognitive load ────────────────────────────────────────────────────────────
# 60 points per calendar event, max 300 points/day

LOAD_PER_EVENT = 60
MAX_DAILY_LOAD = 300
