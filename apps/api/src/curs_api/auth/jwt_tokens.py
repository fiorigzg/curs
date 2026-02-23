from datetime import UTC, datetime, timedelta
from uuid import UUID

import jwt

from curs_api.settings import settings

ALGO = "HS256"


class TokenError(Exception):
    """Raised when token decoding/validation fails."""


def _encode(sub: str, kind: str, ttl: timedelta) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": sub,
        "kind": kind,
        "iat": int(now.timestamp()),
        "exp": int((now + ttl).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGO)


def make_access(user_id: UUID | str) -> str:
    return _encode(str(user_id), "access", timedelta(minutes=settings.access_token_ttl_min))


def make_refresh(user_id: UUID | str) -> str:
    return _encode(str(user_id), "refresh", timedelta(days=settings.refresh_token_ttl_days))


def decode(token: str, *, expect_kind: str) -> str:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGO])
    except jwt.PyJWTError as exc:
        raise TokenError("invalid_token") from exc
    if payload.get("kind") != expect_kind:
        raise TokenError("wrong_token_kind")
    sub = payload.get("sub")
    if not sub:
        raise TokenError("missing_sub")
    return sub
