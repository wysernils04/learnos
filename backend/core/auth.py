import logging
from uuid import UUID

import jwt
from jwt import PyJWKClient
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from core.config import settings

logger = logging.getLogger(__name__)

_bearer = HTTPBearer()

# Fetches Supabase public signing keys and caches them for 5 minutes (PyJWT default).
_jwks_client = PyJWKClient(
    f"{settings.supabase_url}/auth/v1/.well-known/jwks.json",
    cache_keys=True,
)


class CurrentUser(BaseModel):
    id: UUID
    email: str


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> CurrentUser:
    token = credentials.credentials
    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
        )
    except (jwt.ExpiredSignatureError, jwt.PyJWTError) as exc:
        try:
            header = jwt.get_unverified_header(token)
            unverified = jwt.decode(token, options={"verify_signature": False})
        except Exception as parse_exc:
            header = f"<could not parse header: {parse_exc}>"
            unverified = {}
        logger.error(
            "JWT verification failed | "
            "jwks_url=%s | "
            "exc_type=%s | "
            "exc=%s | "
            "token_header=%s | "
            "token_payload_unverified=%s",
            _jwks_client.jwks_uri,
            type(exc).__name__,
            exc,
            header,
            unverified,
        )
        if isinstance(exc, jwt.ExpiredSignatureError):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token: {type(exc).__name__}: {exc}",
                headers={"WWW-Authenticate": "Bearer"},
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {type(exc).__name__}: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject claim",
        )

    return CurrentUser(id=UUID(sub), email=payload.get("email", ""))
