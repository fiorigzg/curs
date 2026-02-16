"""Worker supervisor — Этап 3.

Запускает три воркера в одном процессе через asyncio.gather с авто-рестартом
при падении (supervised). Каждый воркер — бесконечный async-цикл со своим
интервалом. Tortoise/Redis инициализируются один раз на процесс.
"""
import asyncio
import logging
import signal

import structlog

from curs_workers import (
    analytics_worker,
    portfolio_sync_worker,
    price_history_worker,
    quotes_worker,
    risk_metrics_worker,
)
from curs_workers.db import lifespan_db
from curs_workers.heartbeat import heartbeat_loop
from curs_workers.settings import settings

WORKERS = {
    "quotes": quotes_worker.run,
    "portfolio_sync": portfolio_sync_worker.run,
    "risk_metrics": risk_metrics_worker.run,
    "price_history": price_history_worker.run,
    "analytics": analytics_worker.run,
}


def _configure_logging() -> None:
    level = getattr(logging, settings.log_level.upper(), logging.INFO)
    logging.basicConfig(level=level, format="%(message)s")
    processors: list = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
    ]
    if settings.log_format == "json":
        processors.append(structlog.processors.JSONRenderer())
    else:
        processors.append(structlog.dev.ConsoleRenderer())
    structlog.configure(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(level),
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


async def _supervised(name: str, coro_fn, stop: asyncio.Event) -> None:
    """Перезапускает воркер при падении, пока не выставлен stop."""
    log = structlog.get_logger()
    backoff = 2
    while not stop.is_set():
        try:
            await coro_fn()
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # noqa: BLE001
            log.error("worker.crash", worker=name, error=str(exc), restart_in=backoff)
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 60)
        else:
            # Воркер не должен завершаться сам; если вышел — рестартуем.
            log.warning("worker.exited", worker=name)
            await asyncio.sleep(backoff)


async def _main() -> None:
    _configure_logging()
    log = structlog.get_logger()
    log.info("workers.startup", postgres=settings.postgres_host, redis=settings.redis_host)

    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop.set)

    async with lifespan_db():
        tasks = [
            asyncio.create_task(heartbeat_loop(), name="heartbeat"),
            *[
                asyncio.create_task(_supervised(name, fn, stop), name=name)
                for name, fn in WORKERS.items()
            ],
        ]
        await stop.wait()
        log.info("workers.stopping")
        for t in tasks:
            t.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
    log.info("workers.shutdown")


if __name__ == "__main__":
    asyncio.run(_main())
