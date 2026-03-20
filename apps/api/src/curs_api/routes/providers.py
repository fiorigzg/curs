import time
from datetime import datetime, timezone
from typing import Literal

import httpx
import structlog
from fastapi import APIRouter, Depends, HTTPException, status

from curs_api.auth.fernet_util import decrypt_json, encrypt_json
from curs_api.deps import get_current_user
from curs_api.models import ProviderConnection, ProviderKind, User
from curs_api.schemas.provider import ProviderOut, ProviderTestResult, ProviderUpdate

router = APIRouter(prefix="/users/me/providers", tags=["providers"])

log = structlog.get_logger()

_SECRET_FIELDS = {"token", "apiKey", "api_key"}


def _mask(value: str) -> str:
    if not value:
        return ""
    if len(value) <= 4:
        return "***"
    return "***" + value[-4:]


def _read_fields(conn: ProviderConnection) -> dict:
    if not conn.fields_enc:
        return {}
    try:
        return decrypt_json(conn.fields_enc)
    except Exception:  # noqa: BLE001
        log.warning("provider.decrypt_fail", provider=str(conn.provider))
        return {}


def _serialize(conn: ProviderConnection) -> ProviderOut:
    raw = _read_fields(conn)
    masked = {k: (_mask(v) if k in _SECRET_FIELDS and isinstance(v, str) else v) for k, v in raw.items()}
    return ProviderOut(
        id=str(conn.provider),  # type: ignore[arg-type]
        connected=conn.connected,
        fields=masked,
        last_test_ok=conn.last_test_ok,
        last_test_latency_ms=conn.last_test_latency_ms,
    )


@router.get("", response_model=list[ProviderOut])
async def list_providers(user: User = Depends(get_current_user)) -> list[ProviderOut]:
    # Гарантируем по записи на каждого провайдера для удобства UI.
    for kind in (ProviderKind.TINKOFF, ProviderKind.COINGECKO):
        await ProviderConnection.get_or_create(user=user, provider=kind)
    conns = await ProviderConnection.filter(user=user)
    return [_serialize(c) for c in conns]


@router.put("/{provider_id}", response_model=ProviderOut)
async def upsert_provider(
    provider_id: Literal["tinkoff", "coingecko"],
    body: ProviderUpdate,
    user: User = Depends(get_current_user),
) -> ProviderOut:
    kind = ProviderKind(provider_id)
    conn, _ = await ProviderConnection.get_or_create(user=user, provider=kind)
    # Merge новые поля поверх старых (чтобы masked-значения не затирали реальные).
    existing = _read_fields(conn)
    merged = dict(existing)
    for k, v in body.fields.items():
        if isinstance(v, str) and v.startswith("***"):
            continue  # пользователь не менял этот секрет
        merged[k] = v
    conn.fields_enc = encrypt_json(merged) if merged else None
    conn.connected = body.connected
    await conn.save()
    return _serialize(conn)


@router.post("/{provider_id}/test", response_model=ProviderTestResult)
async def test_provider(
    provider_id: Literal["tinkoff", "coingecko"], user: User = Depends(get_current_user)
) -> ProviderTestResult:
    kind = ProviderKind(provider_id)
    conn = await ProviderConnection.get_or_none(user=user, provider=kind)
    if not conn:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="provider_not_configured")

    fields = _read_fields(conn)
    started = time.monotonic()
    ok = False
    err: str | None = None

    try:
        if kind == ProviderKind.COINGECKO:
            api_key = fields.get("apiKey") or fields.get("api_key")
            params = {"x_cg_demo_api_key": api_key} if api_key else {}
            async with httpx.AsyncClient(timeout=5.0) as client:
                r = await client.get("https://api.coingecko.com/api/v3/ping", params=params)
            ok = r.status_code == 200
            if not ok:
                err = f"http_{r.status_code}"
        elif kind == ProviderKind.TINKOFF:
            token = fields.get("token")
            if not token:
                err = "token_missing"
            else:
                # Реальный вызов UsersService/GetInfo через REST-gateway.
                from curs_api.integrations import tinkoff

                ok = await tinkoff.test_token(token)
                if not ok:
                    err = "auth_failed"
    except httpx.HTTPError as e:
        err = f"http_error:{type(e).__name__}"
    except Exception as e:  # noqa: BLE001
        err = f"error:{type(e).__name__}"

    latency_ms = int((time.monotonic() - started) * 1000)
    conn.last_test_ok = ok
    conn.last_test_latency_ms = latency_ms
    conn.last_tested_at = datetime.now(timezone.utc)
    await conn.save()
    return ProviderTestResult(ok=ok, latency_ms=latency_ms, error=err)
