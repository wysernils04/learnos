"""
Anthropic Claude API service.
API key is decrypted per-request from user_settings — never stored in memory.
"""
from __future__ import annotations

import json

import anthropic
from cryptography.fernet import Fernet

from core.config import settings

_MODEL = "claude-haiku-4-5-20251001"  # cost-effective for MCQ generation


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
    """Call Claude to generate quiz questions. Returns list of raw question dicts."""
    if question_types is None:
        question_types = ["multiple_choice", "true_false"]

    api_key = _decrypt_key(encrypted_api_key)
    client = anthropic.AsyncAnthropic(api_key=api_key)

    type_str = ", ".join(question_types)
    prompt = f"""Generate {num_questions} quiz questions about "{topic_name}".

Context:
{topic_context}

Return a JSON array. Each item must have:
- "question": string
- "answer": string  (the correct answer text)
- "question_type": one of [{type_str}]
- "options": array of {{"label": "A", "text": "..."}} for multiple_choice (4 options, one correct); null for others

Rules:
- For multiple_choice: include exactly 4 options; the correct answer text must match one option's text exactly
- For true_false: answer must be "True" or "False"
- Vary question types across the list
- Questions must be answerable from the context

Return ONLY the JSON array, no markdown, no other text."""

    message = await client.messages.create(
        model=_MODEL,
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())
