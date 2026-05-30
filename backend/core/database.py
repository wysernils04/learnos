from typing import AsyncGenerator
from urllib.parse import unquote

import asyncpg
from asyncpg import Connection, Pool

from core.config import settings

_pool: Pool | None = None


def _parse_db_url(dsn: str) -> dict:
    """
    Parse a postgresql:// DSN into keyword args for asyncpg.create_pool.

    Standard urlparse breaks when the password contains unencoded '@' or '/'
    characters. This parser handles those correctly:
    - splits on the LAST '@' to find the host (handles '@' in password)
    - splits on the FIRST ':' to find the username (Postgres usernames can't
      contain ':'), so everything after is the password
    - calls unquote() so percent-encoded passwords (%40 → @) also work
    """
    # Strip scheme
    rest = dsn.split("://", 1)[1]
    # LAST '@' separates userinfo from host
    at = rest.rfind("@")
    userinfo, hostinfo = rest[:at], rest[at + 1:]
    # FIRST ':' separates user from password
    colon = userinfo.index(":")
    user = unquote(userinfo[:colon])
    password = unquote(userinfo[colon + 1:])
    # Parse host:port/database with a clean string (no '@' confusion here)
    host_part, _, path = hostinfo.partition("/")
    host, _, port_str = host_part.rpartition(":")
    return dict(
        host=host or host_part,
        port=int(port_str) if port_str.isdigit() else 5432,
        user=user,
        password=password,
        database=path or "postgres",
    )


async def init_pool() -> None:
    global _pool
    # statement_cache_size=0: Supavisor transaction mode does not support
    # prepared statements; asyncpg must send simple queries instead.
    _pool = await asyncpg.create_pool(
        **_parse_db_url(settings.database_url),
        min_size=1,
        max_size=10,
        command_timeout=30,
        ssl="require",
        statement_cache_size=0,
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
