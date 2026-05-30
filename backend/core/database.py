from typing import AsyncGenerator

import asyncpg
from asyncpg import Connection, Pool

from core.config import settings

_pool: Pool | None = None


async def init_pool() -> None:
    global _pool
    _pool = await asyncpg.create_pool(
        settings.database_url,
        min_size=2,
        max_size=10,
        command_timeout=30,
        ssl="require",
    )


async def close_pool() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


async def get_db() -> AsyncGenerator[Connection, None]:
    assert _pool is not None, "Database pool not initialised — call init_pool() at startup"
    async with _pool.acquire() as conn:
        yield conn
