"""quotes_worker — опрос текущих цен и публикация live-обновлений.

Цикл каждые QUOTES_POLL_INTERVAL_SEC (10–15с):
  1. crypto-активы → CoinGecko /simple/price
  2. tradfi + fiat (USD/EUR) → T-Invest last_prices (FIGI кэшируется в Asset)
  3. fiat-курсы дублируем из ЦБ РФ (надёжный дневной курс)
  4. Обновляем Asset.current_price + публикуем в Redis `quotes:updates`
  5. Раз в день добавляем точку в Quote (для equity-кривой)

На самом первом тике запускаем backfill (решение 2c).
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import structlog
from curs_api.integrations import cbr, coingecko, tinkoff
from curs_api.integrations.cache import publish
from curs_api.models import Asset, AssetClass, Quote

from curs_workers.backfill import backfill_all
from curs_workers.heartbeat import HEARTBEAT_PATH
from curs_workers.settings import settings

log = structlog.get_logger()

QUOTES_CHANNEL = "quotes:updates"


async def _resolve_figis(assets: list[Asset]) -> dict[str, str]:
    """{asset_id: figi}, резолвим недостающие и кэшируем в БД (решение 1a)."""
    out: dict[str, str] = {}
    for a in assets:
        if a.tinkoff_figi:
            out[a.id] = a.tinkoff_figi
            continue
        try:
            figi = await tinkoff.resolve_figi(a.id)
        except Exception as exc:  # noqa: BLE001
            log.warning("quotes.figi_fail", asset=a.id, error=str(exc))
            figi = None
        if figi:
            a.tinkoff_figi = figi
            await a.save(update_fields=["tinkoff_figi"])
            out[a.id] = figi
    return out


async def _persist_daily(asset: Asset, price: Decimal, now: datetime) -> None:
    """Не чаще раза в день добавляем точку в Quote."""
    last = await Quote.filter(asset=asset).order_by("-ts").first()
    if last and (now - last.ts) < timedelta(hours=20):
        return
    src = "coingecko" if asset.asset_class == AssetClass.CRYPTO else "tinkoff"
    await Quote.create(asset=asset, ts=now, price=price, source=src)


async def poll_once() -> int:
    """Один проход опроса. Возвращает число обновлённых активов."""
    assets = await Asset.all()
    by_id = {a.id: a for a in assets}
    now = datetime.now(timezone.utc)
    updated: dict[str, float] = {}

    # 1) crypto через CoinGecko. CG-id берём из asset.coingecko_id, иначе из
    #    статической карты тикеров; найденный id кэшируем в БД (self-heal).
    crypto = [a for a in assets if a.asset_class == AssetClass.CRYPTO]
    cg_by_asset: dict[str, str] = {}
    for a in crypto:
        cg = a.coingecko_id or coingecko.TICKER_TO_CG_ID.get(a.id)
        if not cg:
            continue
        cg_by_asset[a.id] = cg
        if not a.coingecko_id:
            a.coingecko_id = cg
            await a.save(update_fields=["coingecko_id"])
    if cg_by_asset:
        try:
            by_cg = await coingecko.simple_prices(list(set(cg_by_asset.values())))
            for aid, cg in cg_by_asset.items():
                if by_cg.get(cg) is not None:
                    updated[aid] = by_cg[cg]
        except Exception as exc:  # noqa: BLE001
            log.warning("quotes.coingecko_fail", error=str(exc))

    # 2) tradfi + non-RUB fiat через T-Invest
    tinkoff_assets = [
        a for a in assets
        if a.asset_class == AssetClass.TRADFI
        or (a.asset_class == AssetClass.FIAT and a.id != "RUB")
    ]
    figis = await _resolve_figis(tinkoff_assets)
    if figis:
        try:
            prices = await tinkoff.last_prices(list(figis.values()))
            figi_to_id = {v: k for k, v in figis.items()}
            for figi, px in prices.items():
                aid = figi_to_id.get(figi)
                if aid and px > 0:
                    updated[aid] = px
        except Exception as exc:  # noqa: BLE001
            log.warning("quotes.tinkoff_fail", error=str(exc))

    # 3) fiat-курсы из ЦБ (надёжнее для USD/EUR)
    try:
        fx = await cbr.fx_rates()
        for ccy in ("USD", "EUR"):
            if ccy in by_id and ccy in fx:
                updated[ccy] = fx[ccy]
    except Exception as exc:  # noqa: BLE001
        log.warning("quotes.cbr_fail", error=str(exc))

    # 4) запись + публикация
    for aid, px in updated.items():
        asset = by_id.get(aid)
        if not asset:
            continue
        price_dec = Decimal(str(px))
        asset.current_price = price_dec
        asset.current_price_at = now
        await asset.save(update_fields=["current_price", "current_price_at"])
        await _persist_daily(asset, price_dec, now)
        await publish(
            QUOTES_CHANNEL,
            {"type": "quote", "assetId": aid, "price": px, "ts": now.isoformat()},
        )
    return len(updated)


async def run() -> None:
    log.info("quotes_worker.start", interval=settings.quotes_poll_interval_sec)
    # Бэкфилл истории — один раз при старте (идемпотентно).
    try:
        await backfill_all()
    except Exception as exc:  # noqa: BLE001
        log.error("quotes_worker.backfill_error", error=str(exc))

    while True:
        try:
            n = await poll_once()
            log.info("quotes_worker.tick", updated=n)
        except Exception as exc:  # noqa: BLE001
            log.error("quotes_worker.tick_error", error=str(exc))
        HEARTBEAT_PATH.touch(exist_ok=True)
        await asyncio.sleep(settings.quotes_poll_interval_sec)
