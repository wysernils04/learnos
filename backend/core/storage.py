"""Supabase Storage client — lazy-initialized singleton."""
from __future__ import annotations

from supabase import Client, create_client

from core.config import settings

BUCKET = "learnos-files"

_client: Client | None = None


def get_storage() -> Client:
    global _client
    if _client is None:
        _client = create_client(settings.supabase_url, settings.supabase_service_key)
    return _client


def ensure_bucket() -> None:
    """Create the storage bucket if it doesn't exist (called at startup)."""
    client = get_storage()
    buckets = [b.name for b in client.storage.list_buckets()]
    if BUCKET not in buckets:
        client.storage.create_bucket(BUCKET, options={"public": False})
