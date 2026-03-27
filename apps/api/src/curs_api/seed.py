"""Dev-seed: каталог активов и simulated quote history.

Запуск:
    docker compose exec api python -m curs_api.seed

Идемпотентно: повторный запуск не создаёт дубликатов.
Replaces `data.js` simulated dataset 1-в-1, чтобы фронт мог работать
до подключения настоящих провайдеров (Stage 3).
"""
import asyncio
import math
import random
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import structlog
from tortoise import Tortoise

from curs_api.db import TORTOISE_ORM
from curs_api.models import Asset, AssetClass, Quote

# Каталог 14 активов из data.js
ASSETS_SEED = [
    # Fiat
    {"id": "RUB", "name": "Рубль",  "class": AssetClass.FIAT, "ccy": "RUB", "icon": "a-rub", "price": 1.00,   "seed": 31, "mu": 0.0,   "sigma": 0.0},
    {"id": "USD", "name": "Доллар", "class": AssetClass.FIAT, "ccy": "USD", "icon": "a-usd", "price": 93.20,  "seed": 32, "mu": 0.04,  "sigma": 0.08, "start": 85.7},
    {"id": "EUR", "name": "Евро",   "class": AssetClass.FIAT, "ccy": "EUR", "icon": "a-eur", "price": 102.5,  "seed": 33, "mu": 0.03,  "sigma": 0.07, "start": 94.3},
    # Tradfi
    {"id": "SBER",     "name": "Сбербанк",     "class": AssetClass.TRADFI, "subclass": "Акция",     "ccy": "RUB", "icon": "a-sber", "price": 332.40,  "seed": 11, "mu": 0.18,  "sigma": 0.28, "start": 230},
    {"id": "YNDX",     "name": "Яндекс",       "class": AssetClass.TRADFI, "subclass": "Акция",     "ccy": "RUB", "icon": "a-yndx", "price": 4318.0,  "seed": 13, "mu": 0.32,  "sigma": 0.36, "start": 2900},
    {"id": "LKOH",     "name": "Лукойл",       "class": AssetClass.TRADFI, "subclass": "Акция",     "ccy": "RUB", "icon": "a-lkoh", "price": 7416.0,  "seed": 14, "mu": 0.10,  "sigma": 0.22, "start": 6800},
    {"id": "GAZP",     "name": "Газпром",      "class": AssetClass.TRADFI, "subclass": "Акция",     "ccy": "RUB", "icon": "a-gazp", "price": 142.18,  "seed": 12, "mu": -0.08, "sigma": 0.32, "start": 165},
    {"id": "AAPL",     "name": "Apple",        "class": AssetClass.TRADFI, "subclass": "Акция",     "ccy": "USD", "icon": "a-aapl", "price": 232.55,  "seed": 15, "mu": 0.20,  "sigma": 0.24, "start": 175},
    {"id": "NVDA",     "name": "NVIDIA",       "class": AssetClass.TRADFI, "subclass": "Акция",     "ccy": "USD", "icon": "a-nvda", "price": 168.91,  "seed": 16, "mu": 0.85,  "sigma": 0.42, "start": 64},
    {"id": "OFZ26240", "name": "ОФЗ-26240",    "class": AssetClass.TRADFI, "subclass": "Облигация", "ccy": "RUB", "icon": "a-ofz",  "price": 71.85,   "seed": 19, "mu": 0.10,  "sigma": 0.06, "start": 65},
    {"id": "VTBR",     "name": "VTB ETF Корп", "class": AssetClass.TRADFI, "subclass": "ETF",       "ccy": "RUB", "icon": "a-vtbr", "price": 113.25,  "seed": 27, "mu": 0.08,  "sigma": 0.05, "start": 108},
    # Crypto
    {"id": "BTC", "name": "Bitcoin",  "class": AssetClass.CRYPTO, "ccy": "USD", "icon": "a-btc", "price": 96420.0, "seed": 17, "mu": 0.55, "sigma": 0.58, "start": 45000},
    {"id": "ETH", "name": "Ethereum", "class": AssetClass.CRYPTO, "ccy": "USD", "icon": "a-eth", "price": 3215.0,  "seed": 18, "mu": 0.40, "sigma": 0.65, "start": 2300},
    {"id": "SOL", "name": "Solana",   "class": AssetClass.CRYPTO, "ccy": "USD", "icon": "a-sol", "price": 213.0,   "seed": 22, "mu": 0.60, "sigma": 0.85, "start": 90},
]

DAYS = 365


def _gen_series(seed: int, start: float, mu: float, sigma: float, end: float) -> list[float]:
    """GBM-like симуляция с rescale на финальную цену (как в data.js)."""
    rnd = random.Random(seed)
    out = []
    px = start
    for _ in range(DAYS):
        u1 = max(1e-9, rnd.random()); u2 = rnd.random()
        z = math.sqrt(-2 * math.log(u1)) * math.cos(2 * math.pi * u2)
        px = px * (1 + mu / 252 + sigma / math.sqrt(252) * z)
        out.append(px)
    scale = end / out[-1] if out[-1] else 1.0
    return [v * scale for v in out]


async def seed_assets() -> None:
    log = structlog.get_logger()
    now = datetime.now(timezone.utc)
    for a in ASSETS_SEED:
        asset, created = await Asset.update_or_create(
            id=a["id"],
            defaults={
                "name": a["name"],
                "asset_class": a["class"],
                "subclass": a.get("subclass"),
                "ccy": a["ccy"],
                "icon": a["icon"],
                "current_price": Decimal(str(a["price"])),
                "current_price_at": now,
            },
        )
        log.info("seed.asset", id=asset.id, created=created)


async def seed_quotes() -> None:
    log = structlog.get_logger()
    now = datetime.now(timezone.utc)
    base = now - timedelta(days=DAYS)
    for a in ASSETS_SEED:
        asset = await Asset.get(id=a["id"])
        existing = await Quote.filter(asset=asset).count()
        if existing >= DAYS - 1:
            log.info("seed.quotes_skip", id=a["id"], existing=existing)
            continue
        start = a.get("start", a["price"] * 0.92)
        series = _gen_series(a["seed"], start, a["mu"], a["sigma"], a["price"])
        quotes = [
            Quote(asset=asset, ts=base + timedelta(days=i), price=Decimal(str(v)), source="seed")
            for i, v in enumerate(series)
        ]
        await Quote.bulk_create(quotes, batch_size=200)
        log.info("seed.quotes", id=a["id"], count=len(quotes))


async def main() -> None:
    await Tortoise.init(config=TORTOISE_ORM)
    try:
        await seed_assets()
        await seed_quotes()
    finally:
        await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(main())
