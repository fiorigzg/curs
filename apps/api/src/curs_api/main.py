from contextlib import asynccontextmanager

import redis.asyncio as redis_async
import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from tortoise import Tortoise

from curs_api.db import MODELS
from curs_api.logging import configure_logging
from curs_api.routes import analytics, analytics_recalc, assets, auth, dashboard, layout, plans, portfolios, providers, transactions, ws
from curs_api.settings import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    log = structlog.get_logger()

    await Tortoise.init(
        db_url=settings.postgres_dsn,
        modules={"models": [m for m in MODELS if m != "aerich.models"]},
    )
    app.state.redis = redis_async.from_url(settings.redis_url, decode_responses=True)
    log.info("api.startup", postgres=settings.postgres_host, redis=settings.redis_host)

    try:
        yield
    finally:
        await app.state.redis.aclose()
        await Tortoise.close_connections()
        log.info("api.shutdown")


app = FastAPI(title="CURS API", version="0.0.1", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    # Dev: пускаем любой localhost-порт (Expo web 8081, 19006 и т.п.) без ручной подгонки.
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(portfolios.router)
app.include_router(assets.router)
app.include_router(transactions.router)
app.include_router(plans.router)
app.include_router(providers.router)
app.include_router(layout.router)
app.include_router(analytics.router)
app.include_router(analytics_recalc.router)
app.include_router(ws.router)


@app.get("/health")
async def health() -> dict:
    db_ok = await _check_db()
    redis_ok = await _check_redis()
    return {"ok": db_ok and redis_ok, "db": db_ok, "redis": redis_ok}


@app.get("/health/db")
async def health_db() -> dict:
    return {"ok": await _check_db()}


@app.get("/health/redis")
async def health_redis() -> dict:
    return {"ok": await _check_redis()}


async def _check_db() -> bool:
    try:
        conn = Tortoise.get_connection("default")
        await conn.execute_query("SELECT 1")
        return True
    except Exception:
        return False


async def _check_redis() -> bool:
    try:
        return await app.state.redis.ping()
    except Exception:
        return False
