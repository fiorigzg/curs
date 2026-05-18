"""analytics_worker — консьюмер очереди пересчёта аналитики.

Цикл: BRPOP job_id → mark_running → догрузка/заполнение пропусков данных →
run_pipeline (per_asset → … → monte_carlo) с записью прогресса по секциям →
mark_done. При ошибке — mark_failed с текстом. Идемпотентность задач — на уровне
очереди (recalc:active:{pf}).
"""
from __future__ import annotations

import structlog
from curs_api.models import Portfolio
from curs_api.services import recalc_queue as q

from curs_workers import analytics, price_history
from curs_workers.heartbeat import HEARTBEAT_PATH

log = structlog.get_logger()

# Доля прогресса на пред-шаг догрузки данных (далее секции занимают 10→100%).
DATA_PROGRESS = 10


async def process_job(job_id: str) -> None:
    job = await q.get_job(job_id)
    if not job:
        log.warning("analytics_worker.missing_job", job=job_id)
        return
    portfolio_id = job["portfolioId"]
    sections = job["sections"]
    params = job.get("params") or {}

    portfolio = await Portfolio.get_or_none(id=portfolio_id)
    if not portfolio:
        await q.mark_failed(job_id, portfolio_id, "portfolio_not_found")
        return

    await q.mark_running(job_id)
    try:
        # 1) Догрузка/заполнение пропусков истории по активам портфеля + бенчмарк + rf.
        ids = await price_history.portfolio_asset_ids(portfolio_id)
        summary = await price_history.ensure_for_assets(ids)
        log.info("analytics_worker.data_ready", job=job_id, **summary)
        await q.set_progress(job_id, DATA_PROGRESS)

        # 2) Пайплайн аналитики с масштабированием прогресса в диапазон 10→100%.
        async def cb(section_progress: int, done_section: str) -> None:
            scaled = DATA_PROGRESS + int(section_progress / 100 * (100 - DATA_PROGRESS))
            await q.set_progress(job_id, scaled, done_section=done_section)

        await analytics.run_pipeline(portfolio, sections, params, progress_cb=cb)
        await q.mark_done(job_id, portfolio_id)
        log.info("analytics_worker.job_done", job=job_id, portfolio=portfolio_id)
    except Exception as exc:  # noqa: BLE001
        log.error("analytics_worker.job_fail", job=job_id, error=str(exc))
        await q.mark_failed(job_id, portfolio_id, str(exc))


async def run() -> None:
    log.info("analytics_worker.start")
    while True:
        try:
            job_id = await q.pop_job(timeout=5)
            if job_id:
                await process_job(job_id)
        except Exception as exc:  # noqa: BLE001
            log.error("analytics_worker.loop_error", error=str(exc))
        HEARTBEAT_PATH.touch(exist_ok=True)
