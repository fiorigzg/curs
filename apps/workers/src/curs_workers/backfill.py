"""Бэкфилл реальной 365-дневной истории котировок (решение 2c).

На первом запуске quotes_worker для каждого актива тянем настоящую годовую
историю: tradfi/fiat — через T-Invest candles, crypto — через CoinGecko market_chart.
Реальные точки заменяют seed-данные. Если источник недоступен — seed остаётся,
бэкфилл этого актива повторится при следующем старте (идемпотентность по source).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal

import structlog
from curs_api.integrations import cbr, coingecko, cryptocompare, tinkoff
from curs_api.models import Asset, AssetClass, Quote

log = structlog.get_logger()

BACKFILL_FLAG = "curs:backfill:done"

# Глубина истории курсов валют из ЦБ (дней). ~5 лет покрывают старые сделки.
FX_HISTORY_DAYS = 1825


async def _backfilled(asset: Asset) -> bool:
    """Уже есть реальные (не seed) котировки за последние ~300 дней?"""
    return await Quote.filter(asset=asset).exclude(source="seed").count() > 200


async def _has_long_history(asset: Asset, min_days: int = 400) -> bool:
    """Есть ли уже многолетняя история (старейшая не-seed точка старше min_days)?"""
    oldest = await Quote.filter(asset=asset).exclude(source="seed").order_by("ts").first()
    if not oldest:
        return False
    return (datetime.now(timezone.utc) - oldest.ts).days >= min_days


async def _backfill_fiat(asset: Asset) -> int:
    """Курс валюты: многолетняя дневная история из ЦБ (USD/EUR/…); fallback — Tinkoff."""
    ccy = asset.id if asset.id in cbr.CBR_CCY_CODE else (
        asset.ccy if asset.ccy in cbr.CBR_CCY_CODE else None
    )
    if ccy:
        if await _has_long_history(asset):
            return 0  # длинная история уже есть
        points = await cbr.fx_history(ccy, days=FX_HISTORY_DAYS)
        if points:
            # Чистая замена короткой (годовой) истории на многолетнюю из ЦБ.
            await Quote.filter(asset=asset).delete()
            rows = [
                Quote(asset=asset, ts=ts, price=Decimal(str(px)), source="cbr")
                for ts, px in points
                if px and px > 0
            ]
            if rows:
                await Quote.bulk_create(rows, batch_size=500, ignore_conflicts=True)
            return len(rows)
    # Нет кода ЦБ или ЦБ недоступен — годовая история через Tinkoff (как раньше).
    if await _backfilled(asset):
        return 0
    figi = asset.tinkoff_figi or await tinkoff.resolve_figi(asset.id)
    if not figi:
        return 0
    if not asset.tinkoff_figi:
        asset.tinkoff_figi = figi
        await asset.save(update_fields=["tinkoff_figi"])
    candle_points = await tinkoff.candles(figi, days=365)
    return await _replace_quotes(asset, candle_points, "tinkoff")


async def _backfill_crypto(asset: Asset, cg_id: str | None) -> int:
    """Крипта: многолетняя дневная история из CryptoCompare; fallback — CoinGecko (365д).

    CoinGecko demo режет историю до года, поэтому старые сделки оценивались по самой
    ранней котировке (плоский левый край графика). CryptoCompare даёт ~5.5 лет."""
    if await _has_long_history(asset):
        return 0  # длинная история уже есть — идемпотентно

    points = await cryptocompare.histoday(asset.id, days=FX_HISTORY_DAYS)
    if points:
        # Чистая замена короткой (годовой) истории на многолетнюю.
        await Quote.filter(asset=asset).delete()
        rows = [
            Quote(asset=asset, ts=ts, price=Decimal(str(px)), source="cryptocompare")
            for ts, px in points
            if px and px > 0
        ]
        if rows:
            await Quote.bulk_create(rows, batch_size=500, ignore_conflicts=True)
        return len(rows)

    # CryptoCompare не знает монету — годовая история через CoinGecko (как раньше).
    if not cg_id:
        return 0
    raw = await coingecko.market_chart(cg_id, days=365)
    cg_points = [(datetime.fromtimestamp(ms / 1000, tz=timezone.utc), px) for ms, px in raw]
    return await _replace_quotes(asset, cg_points, "coingecko")


async def _replace_quotes(asset: Asset, points: list[tuple[datetime, float]], source: str) -> int:
    if not points:
        return 0
    # Удаляем seed-данные этого актива, кладём реальные.
    await Quote.filter(asset=asset, source="seed").delete()
    rows = [
        Quote(asset=asset, ts=ts, price=Decimal(str(px)), source=source)
        for ts, px in points
        if px and px > 0
    ]
    if rows:
        await Quote.bulk_create(rows, batch_size=200, ignore_conflicts=True)
    return len(rows)


async def backfill_asset(asset: Asset) -> int:
    """Возвращает число записанных реальных точек (0 если пропущено/недоступно)."""
    try:
        if asset.id == "RUB":
            return 0  # база, курс всегда 1

        # Валюты — многолетняя история курса из ЦБ (нужна для оценки старых сделок).
        if asset.asset_class == AssetClass.FIAT:
            return await _backfill_fiat(asset)

        # Крипта — многолетняя история из CryptoCompare (свой gate _has_long_history,
        # поэтому проверяем ДО общего _backfilled: годовую историю надо доращивать).
        if asset.asset_class == AssetClass.CRYPTO:
            cg_id = asset.coingecko_id or coingecko.TICKER_TO_CG_ID.get(asset.id)
            if cg_id and not asset.coingecko_id:
                asset.coingecko_id = cg_id  # self-heal для live-воркера и фоллбэка
                await asset.save(update_fields=["coingecko_id"])
            return await _backfill_crypto(asset, cg_id)

        if await _backfilled(asset):
            return 0

        # tradfi (акции/облигации) — через T-Invest свечи
        figi = asset.tinkoff_figi or await tinkoff.resolve_figi(asset.id)
        if not figi:
            log.info("backfill.no_figi", asset=asset.id)
            return 0
        if not asset.tinkoff_figi:
            asset.tinkoff_figi = figi
            await asset.save(update_fields=["tinkoff_figi"])
        candle_points = await tinkoff.candles(figi, days=365)
        return await _replace_quotes(asset, candle_points, "tinkoff")
    except Exception as exc:  # noqa: BLE001
        log.warning("backfill.fail", asset=asset.id, error=str(exc))
        return 0


async def backfill_all() -> None:
    assets = await Asset.all()
    total = 0
    for a in assets:
        n = await backfill_asset(a)
        if n:
            log.info("backfill.done", asset=a.id, points=n)
            total += n
    log.info("backfill.complete", assets=len(assets), points=total)
