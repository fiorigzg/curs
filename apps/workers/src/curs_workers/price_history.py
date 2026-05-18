"""price_history — загрузка дневной total-return истории (adj_close) для риск-аналитики.

Слой хранения — таблица ``asset_prices`` (отдельно от живого тикера ``quotes``):
ровно одна строка на торговый день, с adj_close (скорректированной на дивиденды
ценой). Это входные данные для аналитического движка (Stage 5).

Источники подбираются по активу автоматически:
  tradfi (MOEX + US листинги) → T-Invest свечи
  crypto                      → CryptoCompare (fallback CoinGecko)
  fiat (USD/EUR/…)            → курс к ₽ из ЦБ РФ (история = ряд курса)
Бенчмарк по валюте/классу:    RUB→IMOEX (MOEX ISS), USD→SP500 (T-Invest), crypto→BTC.
Безрисковая ставка:           RU = ключевая ставка ЦБ; US = ModelParams.risk_free_usd.

Идемпотентность: полная перезагрузка ряда (delete+insert) с гейтом «уже свежо
сегодня» — повторный прогон не плодит строк и держит adj_close консистентным при
появлении новых дивидендов. Все загрузки логируются, сетевые вызовы — с ретраями
(tenacity) внутри интеграций.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import structlog
from curs_api.integrations import cbr, coingecko, cryptocompare, moex, tinkoff
from curs_api.models import (
    Asset,
    AssetClass,
    AssetPrice,
    Benchmark,
    Dividend,
    ModelParams,
    RiskFreeRate,
    RiskFreeRegion,
    Transaction,
    TransactionLeg,
)
from finance_core.adjust import adjusted_close_series

log = structlog.get_logger()

# 1.5 года скользящего окна ≈ 380 торговых дней ≈ 560 календарных. Берём с запасом.
WINDOW_DAYS = 580

# Бенчмарк по умолчанию (US risk-free дефолт, если ModelParams нет).
DEFAULT_RISK_FREE_US = 0.045

# Метаданные бенчмарков: как тянуть историю и в какой валюте.
BENCHMARKS: dict[str, dict] = {
    "IMOEX": {"name": "Индекс МосБиржи", "source": "moex", "ccy": "RUB", "secid": "IMOEX"},
    "SP500": {"name": "S&P 500", "source": "tinkoff", "ccy": "USD",
              "ticker_candidates": ["TSPX", "SBSP", "SPY"]},
    "BTC": {"name": "Bitcoin", "source": "cryptocompare", "ccy": "USD", "sym": "BTC"},
}


def benchmark_id_for(asset: Asset) -> str:
    """Подбор бенчмарка по активу (см. docs/analytics.md)."""
    if asset.asset_class == AssetClass.CRYPTO:
        return "BTC"
    if (asset.ccy or "RUB").upper() == "USD":
        return "SP500"
    # RUB-листинги и прочее по умолчанию → индекс МосБиржи (база приложения — ₽).
    return "IMOEX"


# ─────────────────────────── tracked assets ───────────────────────────
async def tracked_asset_ids() -> set[str]:
    """Все активы, встречающиеся в портфелях (ноги транзакций + cash-актив дивидендов)."""
    leg_ids = await TransactionLeg.all().values_list("asset_id", flat=True)
    cash_ids = await Transaction.all().values_list("cash_asset_id", flat=True)
    ids = {a for a in leg_ids if a} | {c for c in cash_ids if c}
    return ids


async def portfolio_asset_ids(portfolio_id) -> set[str]:
    """Активы конкретного портфеля (по ногам его транзакций)."""
    legs = (
        await TransactionLeg.filter(transaction__portfolio_id=portfolio_id)
        .values_list("asset_id", flat=True)
    )
    cash = (
        await Transaction.filter(portfolio_id=portfolio_id)
        .values_list("cash_asset_id", flat=True)
    )
    return {a for a in legs if a} | {c for c in cash if c}


# ─────────────────────────── fetch native history ───────────────────────────
async def _fetch_asset_native(asset: Asset) -> list[tuple[date, float]]:
    """Нативная (в валюте актива) дневная история [(date, close)]. [] при недоступности."""
    cls = asset.asset_class
    if cls == AssetClass.FIAT:
        if (asset.id or "").upper() == "RUB":
            return []  # рубль — база, курс всегда 1, история не нужна
        ccy = asset.id if asset.id in cbr.CBR_CCY_CODE else asset.ccy
        points = await cbr.fx_history(ccy, days=WINDOW_DAYS)
        return [(ts.date(), px) for ts, px in points if px and px > 0]
    if cls == AssetClass.CRYPTO:
        points = await cryptocompare.histoday(asset.id, days=WINDOW_DAYS)
        if points:
            return [(ts.date(), px) for ts, px in points if px and px > 0]
        cg_id = asset.coingecko_id or coingecko.TICKER_TO_CG_ID.get(asset.id)
        if cg_id:
            raw = await coingecko.market_chart(cg_id, days=min(WINDOW_DAYS, 365))
            return [
                (datetime.fromtimestamp(ms / 1000, tz=timezone.utc).date(), px)
                for ms, px in raw
                if px and px > 0
            ]
        return []
    # tradfi → T-Invest свечи
    figi = asset.tinkoff_figi or await tinkoff.resolve_figi(asset.id)
    if not figi:
        log.info("price_history.no_figi", asset=asset.id)
        return []
    if not asset.tinkoff_figi:
        asset.tinkoff_figi = figi
        await asset.save(update_fields=["tinkoff_figi"])
    candles = await tinkoff.candles(figi, days=WINDOW_DAYS)
    return [(ts.date(), close) for ts, close in candles if close and close > 0]


async def _fetch_benchmark_native(bid: str) -> list[tuple[date, float]]:
    meta = BENCHMARKS.get(bid)
    if not meta:
        return []
    src = meta["source"]
    if src == "moex":
        return await moex.index_history(meta["secid"], days=WINDOW_DAYS)
    if src == "cryptocompare":
        points = await cryptocompare.histoday(meta["sym"], days=WINDOW_DAYS)
        return [(ts.date(), px) for ts, px in points if px and px > 0]
    if src == "tinkoff":
        for ticker in meta.get("ticker_candidates", []):
            figi = await tinkoff.resolve_figi(ticker)
            if not figi:
                continue
            candles = await tinkoff.candles(figi, days=WINDOW_DAYS)
            pts = [(ts.date(), c) for ts, c in candles if c and c > 0]
            if pts:
                return pts
    return []


# ─────────────────────────── dividends ───────────────────────────
async def ensure_dividends(asset: Asset) -> list[tuple[date, float]]:
    """Дивиденды актива из БД; если пусто и есть FIGI — подтягиваем из T-Invest и пишем.

    Возвращает [(ex_date, amount_per_share)] для расчёта adj_close."""
    rows = await Dividend.filter(asset=asset).values("ex_date", "amount_per_share")
    if not rows and asset.asset_class == AssetClass.TRADFI:
        figi = asset.tinkoff_figi
        if figi:
            fetched = await tinkoff.dividends(figi, days=WINDOW_DAYS + 60)
            for ex, amount, ccy in fetched:
                await Dividend.update_or_create(
                    asset=asset,
                    ex_date=ex,
                    defaults={"pay_date": ex, "amount_per_share": Decimal(str(amount)), "ccy": ccy},
                )
            return [(ex, amount) for ex, amount, _ in fetched]
    return [(r["ex_date"], float(r["amount_per_share"])) for r in rows]


# ─────────────────────────── store ───────────────────────────
async def _already_fresh(*, asset: Asset | None = None, benchmark: Benchmark | None = None) -> bool:
    """Уже есть строка не старше «вчера» (не перетягиваем одну и ту же дату дважды в день)."""
    qs = AssetPrice.filter(asset=asset) if asset else AssetPrice.filter(benchmark=benchmark)
    last = await qs.order_by("-date").first()
    if not last:
        return False
    return (datetime.now(timezone.utc).date() - last.date) <= timedelta(days=1)


async def _store_series(
    points: list[tuple[date, float]],
    *,
    source: str,
    asset: Asset | None = None,
    benchmark: Benchmark | None = None,
    dividends: list[tuple[date, float]] | None = None,
) -> int:
    """Полная перезапись ряда adj_close (идемпотентно). Возвращает число строк."""
    if not points:
        return 0
    # Схлопываем к одной цене на день и сортируем по дате.
    by_day: dict[date, float] = {}
    for d, px in points:
        by_day[d] = px
    dates = sorted(by_day)
    closes = [by_day[d] for d in dates]
    adj = adjusted_close_series(dates, closes, dividends or [])

    if asset:
        await AssetPrice.filter(asset=asset).delete()
    else:
        await AssetPrice.filter(benchmark=benchmark).delete()

    rows = [
        AssetPrice(
            asset=asset,
            benchmark=benchmark,
            date=d,
            close=Decimal(str(closes[i])),
            adj_close=Decimal(str(adj[i])),
            source=source,
        )
        for i, d in enumerate(dates)
    ]
    await AssetPrice.bulk_create(rows, batch_size=500)
    return len(rows)


# ─────────────────────────── public API ───────────────────────────
async def backfill_asset(asset: Asset, *, force: bool = False) -> int:
    """Загрузить/обновить 1.5-летнюю историю adj_close актива."""
    try:
        if (asset.id or "").upper() == "RUB":
            return 0
        if not force and await _already_fresh(asset=asset):
            return 0
        native = await _fetch_asset_native(asset)
        if not native:
            return 0
        source = _source_for(asset)
        divs = await ensure_dividends(asset) if asset.asset_class == AssetClass.TRADFI else []
        n = await _store_series(native, source=source, asset=asset, dividends=divs)
        log.info("price_history.asset", asset=asset.id, rows=n, source=source)
        return n
    except Exception as exc:  # noqa: BLE001
        log.warning("price_history.asset_fail", asset=asset.id, error=str(exc))
        return 0


async def backfill_benchmark(bid: str, *, force: bool = False) -> int:
    """Загрузить/обновить историю бенчмарка (создаёт строку Benchmark при необходимости)."""
    meta = BENCHMARKS.get(bid)
    if not meta:
        return 0
    try:
        bench, _ = await Benchmark.get_or_create(
            id=bid,
            defaults={"name": meta["name"], "source": meta["source"], "ccy": meta["ccy"]},
        )
        if not force and await _already_fresh(benchmark=bench):
            return 0
        native = await _fetch_benchmark_native(bid)
        if not native:
            return 0
        n = await _store_series(native, source=meta["source"], benchmark=bench)
        log.info("price_history.benchmark", benchmark=bid, rows=n)
        return n
    except Exception as exc:  # noqa: BLE001
        log.warning("price_history.benchmark_fail", benchmark=bid, error=str(exc))
        return 0


async def refresh_risk_free() -> None:
    """Записать сегодняшнюю строку безрисковой ставки для RU и US."""
    today = datetime.now(timezone.utc).date()
    try:
        ru_rate = await cbr.key_rate()
    except Exception:  # noqa: BLE001
        ru_rate = cbr.DEFAULT_KEY_RATE
    await RiskFreeRate.update_or_create(
        date=today,
        region=RiskFreeRegion.RU,
        defaults={"rate_annual": Decimal(str(round(ru_rate, 6))), "source": "cbr"},
    )
    us_rate = DEFAULT_RISK_FREE_US
    mp = await ModelParams.all().first()
    if mp and mp.risk_free_usd is not None:
        us_rate = float(mp.risk_free_usd)
    await RiskFreeRate.update_or_create(
        date=today,
        region=RiskFreeRegion.US,
        defaults={"rate_annual": Decimal(str(round(us_rate, 6))), "source": "model_params"},
    )
    log.info("price_history.risk_free", ru=ru_rate, us=us_rate)


def _source_for(asset: Asset) -> str:
    if asset.asset_class == AssetClass.FIAT:
        return "cbr"
    if asset.asset_class == AssetClass.CRYPTO:
        return "cryptocompare"
    return "tinkoff"


async def ensure_for_assets(asset_ids: set[str], *, force: bool = False) -> dict:
    """Догрузить историю для набора активов + их фиатных валют + бенчмарков + risk-free.

    Вызывается пред-шагом пересчёта аналитики (заполнение пропусков) и ежедневным
    воркером. Возвращает сводку для прогресса/логов."""
    assets = await Asset.filter(id__in=list(asset_ids)) if asset_ids else []
    # Фиатные валюты активов нужны для перевода в ₽ (FX-ряды) — добавляем их тоже.
    extra_fiat = {a.ccy for a in assets if a.ccy and a.ccy != "RUB"}
    fiat_assets = await Asset.filter(asset_class=AssetClass.FIAT, ccy__in=list(extra_fiat)) \
        if extra_fiat else []
    benchmarks = {benchmark_id_for(a) for a in assets}

    rows = 0
    for a in list(assets) + list(fiat_assets):
        rows += await backfill_asset(a, force=force)
    for bid in benchmarks:
        rows += await backfill_benchmark(bid, force=force)
    await refresh_risk_free()
    return {"assets": len(assets), "benchmarks": len(benchmarks), "rows": rows}


async def sync_all(*, force: bool = False) -> dict:
    """Ежедневная синхронизация: все отслеживаемые активы + бенчмарки + risk-free."""
    ids = await tracked_asset_ids()
    return await ensure_for_assets(ids, force=force)
