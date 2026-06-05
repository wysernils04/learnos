import asyncio
import hashlib
import os
import tempfile
from functools import partial
from pathlib import Path
from uuid import UUID

from asyncpg import Connection
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from slowapi import Limiter
from slowapi.util import get_remote_address

from core.algorithms import _chunk_text
from core.auth import CurrentUser, get_current_user
from core.database import get_db
from core.storage import BUCKET, get_storage
from models.schemas import ApiResponse, FileResponse, SearchResultItem, SemanticSearchRequest
from services import embeddings as emb_svc
from services import pdf_service

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

MAX_BYTES = 50 * 1024 * 1024  # 50 MB


def _detect_type(filename: str, content_type: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext == "pdf":
        return "pdf"
    if ext == "txt":
        return "txt"
    if ext in {"mp3", "m4a", "wav", "ogg"} or content_type.startswith("audio/"):
        return "audio"
    raise HTTPException(400, f"Unsupported file type: .{ext}")


@router.get("", response_model=ApiResponse[list[FileResponse]])
async def list_files(
    user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    rows = await db.fetch(
        "SELECT * FROM files WHERE user_id = $1 ORDER BY created_at DESC",
        user.id,
    )
    return ApiResponse.ok([dict(r) for r in rows])


@router.delete("/{file_id}", response_model=ApiResponse[None])
async def delete_file(
    file_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    row = await db.fetchrow(
        "DELETE FROM files WHERE id = $1 AND user_id = $2 RETURNING file_path",
        file_id, user.id,
    )
    if not row:
        raise HTTPException(404, "File not found")
    try:
        get_storage().storage.from_(BUCKET).remove([row["file_path"]])
    except Exception:
        pass
    return ApiResponse.ok(None)


@router.post("/upload", response_model=ApiResponse[FileResponse], status_code=201)
@limiter.limit("20/minute")
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    topic_id: str | None = Form(None),
    user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    content = await file.read()
    if len(content) > MAX_BYTES:
        raise HTTPException(413, "File exceeds 50 MB limit")

    filename = Path(file.filename or "upload").name or "upload"
    file_type = _detect_type(filename, file.content_type or "")
    sha = hashlib.sha256(content).hexdigest()

    # Deduplicate by sha256 per user
    existing = await db.fetchrow(
        "SELECT id FROM files WHERE user_id = $1 AND sha256 = $2",
        user.id, sha,
    )
    if existing:
        row = await db.fetchrow("SELECT * FROM files WHERE id = $1", existing["id"])
        return ApiResponse.ok(dict(row))

    # Upload to Supabase Storage
    storage_path = f"{user.id}/{sha[:8]}/{filename}"
    get_storage().storage.from_(BUCKET).upload(
        storage_path,
        content,
        {"content-type": file.content_type or "application/octet-stream", "upsert": "true"},
    )

    file_row = await db.fetchrow(
        """
        INSERT INTO files (user_id, topic_id, filename, file_path, file_type, sha256)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        """,
        user.id, topic_id, filename, storage_path, file_type, sha,
    )
    file_id = str(file_row["id"])

    if file_type == "audio":
        loop = asyncio.get_running_loop()
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "mp3"

        def _transcribe():
            with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
                tmp.write(content)
                tmp_path = tmp.name
            try:
                from services.whisper_service import transcribe
                return transcribe(tmp_path)
            finally:
                os.unlink(tmp_path)

        try:
            transcript = await loop.run_in_executor(None, _transcribe)
            chunk_pairs: list[tuple[str, int | None]] = [(c, None) for c in _chunk_text(transcript) if c.strip()]

            if chunk_pairs:
                texts = [cp[0] for cp in chunk_pairs]
                vectors = await loop.run_in_executor(None, partial(emb_svc.encode_batch, texts))
                await db.executemany(
                    "INSERT INTO file_chunks (file_id, chunk_index, page_number, chunk_text, embedding) VALUES ($1, $2, $3, $4, $5)",
                    [(file_id, idx, None, chunk_text, str(vec)) for idx, ((chunk_text, _), vec) in enumerate(zip(chunk_pairs, vectors))],
                )
        except Exception:
            chunk_pairs = []

        await db.execute(
            "UPDATE files SET page_count = NULL, chunk_count = $1 WHERE id = $2",
            len(chunk_pairs), file_id,
        )

    elif file_type in ("pdf", "txt"):
        loop = asyncio.get_running_loop()

        if file_type == "pdf":
            def _extract_pdf():
                with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                    tmp.write(content)
                    tmp_path = tmp.name
                try:
                    return pdf_service.extract_text_by_page(tmp_path)
                finally:
                    os.unlink(tmp_path)

            pages = await loop.run_in_executor(None, _extract_pdf)
            page_count = len(pages)
            chunk_pairs: list[tuple[str, int | None]] = [
                (chunk, page_num)
                for page_num, page_text in pages
                for chunk in _chunk_text(page_text)
                if chunk.strip()
            ]
        else:
            page_count = None
            text = content.decode("utf-8", errors="replace")
            chunk_pairs = [(c, None) for c in _chunk_text(text) if c.strip()]

        if chunk_pairs:
            texts = [cp[0] for cp in chunk_pairs]
            vectors = await loop.run_in_executor(None, partial(emb_svc.encode_batch, texts))

            await db.executemany(
                """
                INSERT INTO file_chunks (file_id, chunk_index, page_number, chunk_text, embedding)
                VALUES ($1, $2, $3, $4, $5)
                """,
                [
                    (file_id, idx, page_num, chunk_text, str(vec))
                    for idx, ((chunk_text, page_num), vec) in enumerate(zip(chunk_pairs, vectors))
                ],
            )

        await db.execute(
            "UPDATE files SET page_count = $1, chunk_count = $2 WHERE id = $3",
            page_count, len(chunk_pairs), file_id,
        )

    final = await db.fetchrow("SELECT * FROM files WHERE id = $1", file_id)
    return ApiResponse.ok(dict(final))


@router.post("/search", response_model=ApiResponse[list[SearchResultItem]])
async def semantic_search(
    payload: SemanticSearchRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    loop = asyncio.get_running_loop()
    # Fetch more when filtering by topic so we still return `limit` results
    fetch_limit = payload.limit if payload.topic_id is None else payload.limit * 4
    vector = await loop.run_in_executor(None, partial(emb_svc.encode, payload.query))

    rows = await db.fetch(
        "SELECT * FROM search_file_chunks($1::vector, $2, $3, $4)",
        str(vector), user.id, fetch_limit, payload.similarity_threshold,
    )
    results = [dict(r) for r in rows]
    if payload.topic_id is not None:
        tid = str(payload.topic_id)
        results = [r for r in results if str(r.get("topic_id")) == tid]
    return ApiResponse.ok(results[: payload.limit])
