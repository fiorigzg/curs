"""risk_metrics_worker — периодический пересчёт RiskSnapshot по портфелям.

Для каждого портфеля и диапазона считаем vol/sharpe/sortino/maxDD/cagr/calmar
по реконструированному ряду стоимости (из Quote) и сохраняем в RiskSnapshot
(кэш для быстрых ответов API). Бета считается в Stage 5 риск-эндпоинтами.
"""
from __future__ import annotations

import asyncio
from decimal import Decimal

import structlog
from curs_api.models import Portfolio, RiskSnapshot
from curs_api.services.valuation import portfolio_series_from_quotes
from finance_core import metrics as fc_metrics

from curs_workers.heartbeat import HEARTBEAT_PATH
from curs_workers.settings import settings

log = structlog.get_logger()

RANGE_DAYS = {"1Н": 7, "1М": 31, "3М": 92, "1Г": 365, "Всё": 365}


def _dec(v: float) -> Decimal:
    return Decimal(str(round(v, 8)))


async def compute_for(portfolio: Portfolio) -> int:
    written = 0
    for rng, days in RANGE_DAYS.items():
        pts = await portfolio_series_from_quotes(portfolio, days=days)
        values = [p["v"] for p in pts]
        if len(values) < 2:
            continue
        m = fc_metrics.all_metrics(values, risk_free=0.07)
        await RiskSnapshot.update_or_create(
            portfolio=portfolio,
            range=rng,
            defaults={
                "vol": _dec(m["vol"]),
                "sharpe": _dec(m["sharpe"]),
                "sortino": _dec(m["sortino"]),
                "ann_ret": _dec(m["ann_ret"]),
                "max_dd": _dec(m["max_dd"]),
                "cagr": _dec(m["cagr"]),
                "calmar": _dec(m["calmar"]),
            },
        )
        written += 1
    return written


async def compute_once() -> int:
    portfolios = await Portfolio.all()
    total = 0
    for pf in portfolios:
        try:
            total += await compute_for(pf)
        except Exception as exc:  # noqa: BLE001
            log.warning("risk.compute_fail", portfolio=str(pf.id), error=str(exc))
    return total


async def run() -> None:
    interval = settings.risk_metrics_poll_interval_sec
    log.info("risk_metrics_worker.start", interval=interval)
    while True:
        try:
            n = await compute_once()
            log.info("risk_metrics_worker.tick", snapshots=n)
        except Exception as exc:  # noqa: BLE001
            log.error("risk_metrics_worker.error", error=str(exc))
        HEARTBEAT_PATH.touch(exist_ok=True)
        await asyncio.sleep(interval)
