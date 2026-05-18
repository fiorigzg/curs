"""price_history_worker — ежедневная синхронизация total-return истории.

Триггер (2) из ТЗ: раз в сутки догружает закрытие за вчера для всех отслеживаемых
активов + бенчмарки + безрисковую ставку, заодно заполняя пропуски торговых дней
в окне 1.5 года (price_history.sync_all → backfill с гейтом «уже свежо»).
"""
from __future__ import annotations

import asyncio

import structlog

from curs_workers import price_history
from curs_workers.heartbeat import HEARTBEAT_PATH
from curs_workers.settings import settings

log = structlog.get_logger()


async def run() -> None:
    interval = settings.price_history_poll_interval_sec
    log.info("price_history_worker.start", interval=interval)
    while True:
        try:
            summary = await price_history.sync_all()
            log.info("price_history_worker.tick", **summary)
        except Exception as exc:  # noqa: BLE001
            log.error("price_history_worker.error", error=str(exc))
        HEARTBEAT_PATH.touch(exist_ok=True)
        await asyncio.sleep(interval)
