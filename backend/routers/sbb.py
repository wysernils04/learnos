import httpx
from fastapi import APIRouter, Depends, Query

from core.auth import CurrentUser, get_current_user
from models.schemas import ApiResponse

router = APIRouter()

_SBB_API = "https://transport.opendata.ch/v1"


@router.get("/connections", response_model=ApiResponse[dict])
async def get_sbb_connection(
    from_: str = Query(..., alias="from"),
    to: str = Query(...),
    user: CurrentUser = Depends(get_current_user),
):
    """Proxy to Swiss public transport API — used for study slot travel time."""
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            f"{_SBB_API}/connections",
            params={"from": from_, "to": to, "limit": 3},
        )
        resp.raise_for_status()
    return ApiResponse.ok(resp.json())
