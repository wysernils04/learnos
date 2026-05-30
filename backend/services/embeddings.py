"""
Sentence-transformers embedding service.
Model: paraphrase-multilingual-MiniLM-L12-v2 (384-dim)
Lazy-loaded on first use — import does not trigger download.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

import asyncpg

if TYPE_CHECKING:
    from sentence_transformers import SentenceTransformer

_model: "SentenceTransformer | None" = None
_MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"


def _get_model() -> "SentenceTransformer":
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer  # heavy import

        _model = SentenceTransformer(_MODEL_NAME)
    return _model


def encode(text: str) -> list[float]:
    return _get_model().encode(text).tolist()


def encode_batch(texts: list[str]) -> list[list[float]]:
    return _get_model().encode(texts).tolist()


async def store_chunk_embeddings(
    conn: asyncpg.Connection,
    file_id: str,
    chunks: list[str],
) -> None:
    """Encode chunks and upsert embeddings into file_chunks."""
    vectors = encode_batch(chunks)
    for idx, (chunk_text, vector) in enumerate(zip(chunks, vectors)):
        await conn.execute(
            """
            UPDATE file_chunks
            SET embedding = $1
            WHERE file_id = $2 AND chunk_index = $3
            """,
            vector, file_id, idx,
        )
