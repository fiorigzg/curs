import json
from typing import Any

from cryptography.fernet import Fernet, InvalidToken

from curs_api.settings import settings

_fernet: Fernet | None = None


def _get() -> Fernet:
    global _fernet
    if _fernet is None:
        if not settings.fernet_key:
            raise RuntimeError("FERNET_KEY is not set")
        _fernet = Fernet(settings.fernet_key.encode())
    return _fernet


def encrypt_json(data: dict[str, Any]) -> bytes:
    return _get().encrypt(json.dumps(data).encode())


def decrypt_json(blob: bytes) -> dict[str, Any]:
    try:
        return json.loads(_get().decrypt(blob).decode())
    except (InvalidToken, ValueError, TypeError) as exc:
        raise RuntimeError("Failed to decrypt provider fields") from exc
