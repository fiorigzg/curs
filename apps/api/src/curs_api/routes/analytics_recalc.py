"""API пересчёта риск-аналитики (Stage 5).

Следует конвенциям репо: REST без версионного префикса, camelCase в телах через
CamelModel, JWT-аутентификация, проверка владения портфелем.

Эндпоинты (полные пути и формы — в RECALC.md):
  POST /portfolios/{portfolio_id}/analytics/recalc   — поставить пересчёт в очередь
  GET  /analytics/jobs/{job_id}                      — статус задачи
  GET  /portfolios/{portfolio_id}/analytics/metrics  — последние сохранённые секции
"""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field

from curs_api.deps import get_current_user
from curs_api.models import Portfolio, PortfolioMetric, User
from curs_api.schemas.common import CamelModel
from curs_api.services import recalc_queue as q

router = APIRouter(tags=["analytics-recalc"])


async def _require_portfolio(portfolio_id: UUID, user: User) -> Portfolio:
    p = await Portfolio.get_or_none(id=portfolio_id, user=user)
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="portfolio_not_found")
    return p


# ─────────────────────────── схемы ───────────────────────────
class RecalcRequest(BaseModel):
    """Тело запуска пересчёта. Все поля опциональны."""

    model_config = ConfigDict(populate_by_name=True)

    sections: list[str] | None = Field(
        default=None, description="Подмножество секций; пусто — все по порядку"
    )
    market_shock: float | None = Field(
        default=None, alias="marketShock", description="Доп. сценарий падения рынка (доля, напр. -0.15)"
    )
    simulations: int | None = Field(default=None, ge=10, le=50_000, description="Число путей Monte Carlo")
    horizon: int | None = Field(default=None, ge=20, le=2_520, description="Горизонт MC (торговых дней)")


class JobOut(CamelModel):
    id: str
    portfolio_id: str
    status: str
    progress: int
    sections: list[str]
    done_sections: list[str]
    error: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


class SectionOut(CamelModel):
    payload: dict
    computed_at: datetime


class MetricsResponse(CamelModel):
    portfolio_id: str
    sections: dict[str, SectionOut]


def _job_out(job: dict) -> JobOut:
    return JobOut(
        id=job["id"],
        portfolio_id=job["portfolioId"],
        status=job["status"],
        progress=job["progress"],
        sections=job["sections"],
        done_sections=job.get("doneSections", []),
        error=job.get("error"),
        created_at=job.get("createdAt"),
        updated_at=job.get("updatedAt"),
    )


# ─────────────────────────── эндпоинты ───────────────────────────
@router.post(
    "/portfolios/{portfolio_id}/analytics/recalc",
    response_model=JobOut,
    status_code=status.HTTP_202_ACCEPTED,
)
async def start_recalc(
    portfolio_id: UUID,
    body: RecalcRequest = Body(default_factory=RecalcRequest),
    user: User = Depends(get_current_user),
) -> JobOut:
    """Поставить пересчёт аналитики портфеля в очередь воркера.

    Идемпотентность: если для портфеля уже выполняется задача — возвращаем её id.
    """
    await _require_portfolio(portfolio_id, user)
    unknown = [s for s in (body.sections or []) if s not in q.SECTIONS]
    if unknown:
        raise HTTPException(status_code=422, detail=f"unknown_sections:{','.join(unknown)}")
    params: dict = {}
    if body.market_shock is not None:
        params["marketShock"] = body.market_shock
    if body.simulations is not None:
        params["simulations"] = body.simulations
    if body.horizon is not None:
        params["horizon"] = body.horizon
    job, _created = await q.enqueue_recalc(str(portfolio_id), body.sections, params)
    return _job_out(job)


@router.get("/analytics/jobs/{job_id}", response_model=JobOut)
async def get_job_status(
    job_id: str, user: User = Depends(get_current_user)
) -> JobOut:
    """Статус задачи пересчёта: queued/running/done/failed + прогресс и готовые секции."""
    job = await q.get_job(job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="job_not_found")
    # Проверяем, что задача принадлежит портфелю пользователя.
    await _require_portfolio(UUID(job["portfolioId"]), user)
    return _job_out(job)


@router.get("/portfolios/{portfolio_id}/analytics/metrics", response_model=MetricsResponse)
async def get_analytics_metrics(
    portfolio_id: UUID,
    section: list[str] | None = Query(default=None, description="Фильтр по секции (повторяемый)"),
    user: User = Depends(get_current_user),
) -> MetricsResponse:
    """Последние сохранённые payload'ы аналитики по секции(-ям) с таймстампом расчёта."""
    await _require_portfolio(portfolio_id, user)
    qs = PortfolioMetric.filter(portfolio_id=portfolio_id)
    if section:
        unknown = [s for s in section if s not in q.SECTIONS]
        if unknown:
            raise HTTPException(status_code=422, detail=f"unknown_sections:{','.join(unknown)}")
        qs = qs.filter(metric_key__in=section)
    rows = await qs.all()
    sections = {
        r.metric_key: SectionOut(payload=r.payload, computed_at=r.computed_at) for r in rows
    }
    return MetricsResponse(portfolio_id=str(portfolio_id), sections=sections)
