"""Интеграционный end-to-end тест пересчёта аналитики.

Сеет два фейковых актива + бенчмарк + risk-free + портфель с позициями, прогоняет
весь пайплайн (run_pipeline) и проверяет, что все таблицы метрик заполнены.

Требует БД (Postgres). Локально без БД пропускается на этапе подключения.
"""
import math
import random
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import pytest

from curs_api.auth.password import hash_password
from curs_api.models import (
    Asset,
    AssetClass,
    AssetPrice,
    Benchmark,
    PairwiseMetric,
    Portfolio,
    PortfolioMetric,
    RiskFreeRate,
    RiskFreeRegion,
    Transaction,
    TransactionLeg,
    TransactionType,
    User,
)
from curs_workers import analytics
from curs_workers.analytics import SECTIONS

N_DAYS = 380


def _gbm(seed: int, start: float, mu: float, sigma: float, n: int) -> list[float]:
    rnd = random.Random(seed)
    px = start
    out: list[float] = []
    for _ in range(n):
        px *= 1 + mu / 252 + sigma / math.sqrt(252) * rnd.gauss(0, 1)
        out.append(px)
    return out


async def _seed_prices(asset, benchmark, dates, series, source="seed"):
    qs = AssetPrice.filter(asset=asset) if asset else AssetPrice.filter(benchmark=benchmark)
    await qs.delete()
    await AssetPrice.bulk_create([
        AssetPrice(
            asset=asset, benchmark=benchmark, date=d,
            close=Decimal(str(v)), adj_close=Decimal(str(v)), source=source,
        )
        for d, v in zip(dates, series)
    ])


@pytest.mark.asyncio
async def test_pipeline_end_to_end(db):
    base = date.today()
    dates = [base - timedelta(days=N_DAYS - 1 - i) for i in range(N_DAYS)]

    rub, _ = await Asset.update_or_create(
        id="RUB", defaults={"name": "Рубль", "asset_class": AssetClass.FIAT, "ccy": "RUB",
                            "current_price": Decimal("1")},
    )
    aaa, _ = await Asset.update_or_create(
        id="TST_A", defaults={"name": "Тест A", "asset_class": AssetClass.TRADFI, "ccy": "RUB"},
    )
    bbb, _ = await Asset.update_or_create(
        id="TST_B", defaults={"name": "Тест B", "asset_class": AssetClass.TRADFI, "ccy": "RUB"},
    )
    bench, _ = await Benchmark.get_or_create(
        id="IMOEX", defaults={"name": "Индекс МосБиржи", "source": "moex", "ccy": "RUB"},
    )

    sa = _gbm(1, 100.0, 0.12, 0.22, N_DAYS)
    sb = _gbm(2, 50.0, 0.18, 0.34, N_DAYS)
    sm = _gbm(3, 1000.0, 0.08, 0.18, N_DAYS)
    await _seed_prices(aaa, None, dates, sa)
    await _seed_prices(bbb, None, dates, sb)
    await _seed_prices(None, bench, dates, sm)
    aaa.current_price = Decimal(str(sa[-1]))
    await aaa.save(update_fields=["current_price"])
    bbb.current_price = Decimal(str(sb[-1]))
    await bbb.save(update_fields=["current_price"])

    await RiskFreeRate.update_or_create(
        date=base, region=RiskFreeRegion.RU, defaults={"rate_annual": Decimal("0.16")},
    )

    user = await User.create(
        email=f"pl{uuid.uuid4().hex[:10]}@test.local",
        password_hash=hash_password("TestPass123!"),
        display_name="pipeline",
    )
    pf = await Portfolio.create(user=user, name="pipeline-test")
    now = datetime.now(timezone.utc)
    dep = await Transaction.create(portfolio=pf, type=TransactionType.IN, d=now)
    await TransactionLeg.create(transaction=dep, asset=rub, qty=Decimal("2000000"), side="in")
    for asset, qty in [(aaa, "1000"), (bbb, "2000")]:
        tx = await Transaction.create(portfolio=pf, type=TransactionType.TX, d=now)
        await TransactionLeg.create(transaction=tx, asset=rub, qty=Decimal("500000"), side="out")
        await TransactionLeg.create(transaction=tx, asset=asset, qty=Decimal(qty), side="in")

    try:
        await analytics.run_pipeline(pf, SECTIONS, {"simulations": 1000, "horizon": 60})

        keys = set(await PortfolioMetric.filter(portfolio=pf).values_list("metric_key", flat=True))
        assert keys == set(SECTIONS), f"не все секции записаны: {keys}"

        per_asset = await PortfolioMetric.get(portfolio=pf, metric_key="per_asset")
        assert per_asset.payload["insufficientData"] is False
        assert len(per_asset.payload["assets"]) == 2
        assert all(a["beta"] is not None for a in per_asset.payload["assets"])

        # одна упорядоченная пара (TST_A, TST_B)
        assert await PairwiseMetric.filter(portfolio=pf).count() == 1

        risk = await PortfolioMetric.get(portfolio=pf, metric_key="risk")
        assert "betaP" in risk.payload and risk.payload["scenarios"]

        opt = await PortfolioMetric.get(portfolio=pf, metric_key="optimization")
        assert opt.payload["frontier"] and opt.payload["tangency"]["weights"]

        mc = await PortfolioMetric.get(portfolio=pf, metric_key="monte_carlo")
        assert "var95" in mc.payload["parametric"]["var"]
        assert len(mc.payload["parametric"]["fan"]["p50"]) == 61
    finally:
        await user.delete()  # каскадом снесёт портфель/транзакции/метрики
