"""
Anthropic Claude API service.
API key is decrypted per-request from user_settings — never stored in memory.
"""
from __future__ import annotations

import json

import anthropic
from cryptography.fernet import Fernet

from core.config import settings

_MODEL = "claude-sonnet-4-20250514"


def _decrypt_key(encrypted: str) -> str:
    f = Fernet(settings.fernet_secret.encode())
    return f.decrypt(encrypted.encode()).decode()


def encrypt_key(raw_key: str) -> str:
    f = Fernet(settings.fernet_secret.encode())
    return f.encrypt(raw_key.encode()).decode()


async def generate_quiz_questions(
    encrypted_api_key: str,
    topic_name: str,
    topic_context: str,
    num_questions: int = 5,
    question_types: list[str] | None = None,
) -> list[dict]:
    """Call Claude to generate quiz questions. Returns list of question dicts."""
    if question_types is None:
        question_types = ["multiple_choice", "true_false"]

    api_key = _decrypt_key(encrypted_api_key)
    client = anthropic.Anthropic(api_key=api_key)

    type_str = ", ".join(question_types)
    prompt = f"""Generate {num_questions} quiz questions about "{topic_name}".

Context:
{topic_context}

Return a JSON array. Each item must have:
- "question": string
- "answer": string
- "question_type": one of {type_str}
- "options": array of {{"label": "A/B/C/D", "text": "..."}} for multiple_choice, null otherwise

Return ONLY the JSON array, no other text."""

    message = client.messages.create(
        model=_MODEL,
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()
    # Strip markdown fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())
