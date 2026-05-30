from asyncpg import Connection
from fastapi import APIRouter, Depends, File, Form, UploadFile

from core.auth import CurrentUser, get_current_user
from core.database import get_db
from models.schemas import ApiResponse, FileResponse, SearchResultItem, SemanticSearchRequest

router = APIRouter()


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


@router.post("/upload", response_model=ApiResponse[FileResponse], status_code=201)
async def upload_file(
    file: UploadFile = File(...),
    topic_id: str | None = Form(None),
    user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    """
    Phase 3: upload to Supabase Storage, extract text, chunk, embed, store vectors.
    Stub — returns placeholder.
    """
    return ApiResponse.fail("File upload available in Phase 3")


@router.post("/search", response_model=ApiResponse[list[SearchResultItem]])
async def semantic_search(
    payload: SemanticSearchRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    """Phase 3: encode query with sentence-transformers, call search_file_chunks()."""
    return ApiResponse.ok([])
