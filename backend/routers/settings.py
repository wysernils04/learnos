from asyncpg import Connection
from fastapi import APIRouter, Depends, HTTPException

from core.auth import CurrentUser, get_current_user
from core.database import get_db
from models.schemas import ApiKeyRequest, ApiKeyResponse, ApiResponse
from services.llm import encrypt_key

router = APIRouter()


@router.get("", response_model=ApiResponse[ApiKeyResponse])
async def get_settings(
    user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    row = await db.fetchrow(
        "SELECT anthropic_api_key_encrypted FROM user_settings WHERE user_id = $1", user.id
    )
    has_key = bool(row and row["anthropic_api_key_encrypted"])
    return ApiResponse.ok(ApiKeyResponse(has_key=has_key))


@router.put("/api-key", response_model=ApiResponse[ApiKeyResponse])
async def save_api_key(
    payload: ApiKeyRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    if not payload.anthropic_api_key.startswith("sk-ant-"):
        raise HTTPException(400, "Invalid Anthropic API key format")
    encrypted = encrypt_key(payload.anthropic_api_key)
    await db.execute(
        """
        INSERT INTO user_settings (user_id, anthropic_api_key_encrypted)
        VALUES ($1, $2)
        ON CONFLICT (user_id) DO UPDATE
          SET anthropic_api_key_encrypted = $2, updated_at = NOW()
        """,
        user.id, encrypted,
    )
    return ApiResponse.ok(ApiKeyResponse(has_key=True))


@router.delete("/api-key", response_model=ApiResponse[ApiKeyResponse])
async def delete_api_key(
    user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    await db.execute(
        "UPDATE user_settings SET anthropic_api_key_encrypted = NULL, updated_at = NOW() WHERE user_id = $1",
        user.id,
    )
    return ApiResponse.ok(ApiKeyResponse(has_key=False))
