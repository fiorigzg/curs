"""Прямые вызовы bcrypt без passlib (passlib 1.7 несовместим с bcrypt>=4.1).

Reference: bcrypt(3) ограничивает пароль 72 байтами; чтобы поддержать длинные —
предварительно хэшируем sha256 и base64 на 60 байт. Делаем это явно.
"""
import base64
import hashlib

import bcrypt

# Если пароль > 72 байт — bcrypt молча обрежет. Префиксим sha256 для безопасности.
def _prep(plain: str) -> bytes:
    raw = plain.encode("utf-8")
    if len(raw) > 60:
        digest = hashlib.sha256(raw).digest()
        return base64.b64encode(digest)  # 44 байта, влезает
    return raw


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(_prep(plain), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(_prep(plain), hashed.encode("utf-8"))
    except Exception:
        return False
