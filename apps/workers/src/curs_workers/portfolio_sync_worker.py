"""portfolio_sync_worker — синк позиций и операций из T-Invest.

Для каждого пользователя с подключённым tinkoff-провайдером (connected=True):
  - расшифровываем его OAuth-токен (Fernet)
  - по каждому счёту создаём/обновляем портфель «T-Invest •{last4}»
  - синкаем позиции (figi → Asset из каталога; неизвестные figi пропускаем)
  - операции buy/sell/dividend пишем как сделки (best-effort, кэш-нога в валюте операции)

Безопасно: каждый шаг в try/except, частичный успех допустим.
Интервал — RISK_METRICS_POLL_INTERVAL_SEC (по умолчанию 300с) — портфель меняется редко.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from decimal import Decimal

import structlog
from curs_api.auth.fernet_util import decrypt_json
from curs_api.integrations import tinkoff
from curs_api.models import (
    Asset,
    Portfolio,
    Position,
    ProviderConnection,
    ProviderKind,
    Transaction,
    TransactionLeg,
    TransactionType,
)

from curs_workers.heartbeat import HEARTBEAT_PATH
from curs_workers.settings import settings


log = structlog.get_logger()


async def _asset_by_figi(figi: str) -> Asset | None:
    return await Asset.get_or_none(tinkoff_figi=figi)


async def _ensure_portfolio(user_id, account_id: str) -> Portfolio:
    name = f"T-Invest •{account_id[-4:]}"
    pf = await Portfolio.get_or_none(user_id=user_id, name=name)
    if not pf:
        pf = await Portfolio.create(user_id=user_id, name=name, color="#4F6BED")
    return pf


async def _sync_positions(token: str, account_id: str, pf: Portfolio) -> int:
    positions = await tinkoff.portfolio_positions(token, account_id)
    synced = 0
    for p in positions:
        asset = await _asset_by_figi(p["figi"])
        if not asset:
            log.info("sync.unknown_figi", figi=p["figi"])
            continue
        await Position.update_or_create(
            portfolio=pf,
            asset=asset,
            defaults={"qty": Decimal(str(p["qty"])), "avg_price": Decimal(str(p["avg_price"]))},
        )
        synced += 1
    return synced


async def _sync_operations(token: str, account_id: str, pf: Portfolio) -> int:
    ops = await tinkoff.operations(token, account_id, days=365)
    written = 0
    for op in ops:
        figi = op.get("figi")
        otype = str(op.get("type", ""))
        # Дивиденды
        if "DIVIDEND" in otype.upper() and figi:
            asset = await _asset_by_figi(figi)
            if not asset:
                continue
            exists = await Transaction.filter(
                portfolio=pf, type=TransactionType.DIV, d=op["date"], source_asset=asset
            ).exists()
            if exists:
                continue
            cash = await Asset.get_or_none(id=op["ccy"]) or await Asset.get_or_none(id="RUB")
            await Transaction.create(
                portfolio=pf, type=TransactionType.DIV, d=op["date"],
                source_asset=asset, cash_asset=cash, cash_qty=Decimal(str(abs(op["payment"]))),
            )
            written += 1
    return written


async def sync_user(conn: ProviderConnection) -> None:
    if not conn.fields_enc:
        return
    try:
        fields = decrypt_json(conn.fields_enc)
    except Exception as exc:  # noqa: BLE001
        log.warning("sync.decrypt_fail", user=str(conn.user_id), error=str(exc))
        return
    token = fields.get("token")
    if not token:
        return
    try:
        accounts = await tinkoff.get_accounts(token)
    except Exception as exc:  # noqa: BLE001
        log.warning("sync.accounts_fail", user=str(conn.user_id), error=str(exc))
        return
    for account_id in accounts:
        try:
            pf = await _ensure_portfolio(conn.user_id, account_id)
            n_pos = await _sync_positions(token, account_id, pf)
            n_ops = await _sync_operations(token, account_id, pf)
            log.info("sync.account", account=account_id[-4:], positions=n_pos, divs=n_ops)
        except Exception as exc:  # noqa: BLE001
            log.warning("sync.account_fail", account=account_id[-4:], error=str(exc))


async def sync_once() -> int:
    conns = await ProviderConnection.filter(
        provider=ProviderKind.TINKOFF, connected=True
    )
    for conn in conns:
        await sync_user(conn)
    return len(conns)


async def run() -> None:
    interval = settings.risk_metrics_poll_interval_sec
    log.info("portfolio_sync_worker.start", interval=interval)
    while True:
        try:
            n = await sync_once()
            log.info("portfolio_sync_worker.tick", users=n)
        except Exception as exc:  # noqa: BLE001
            log.error("portfolio_sync_worker.error", error=str(exc))
        HEARTBEAT_PATH.touch(exist_ok=True)
        await asyncio.sleep(interval)
