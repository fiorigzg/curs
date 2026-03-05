"""Группировка ценового ряда в месячные доходности (для heatmap-виджета)."""
from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, datetime


@dataclass
class MonthCell:
    year: int
    month: int  # 0-indexed для совместимости с JS Date.getMonth()
    ret: float


def monthly_returns(points: Sequence[tuple[date | datetime, float]]) -> list[MonthCell]:
    """points: (date, value). Возвращает по одному MonthCell на каждый встретившийся месяц."""
    by_month: dict[tuple[int, int], dict] = {}
    for d, v in points:
        key = (d.year, d.month - 1)
        if key not in by_month:
            by_month[key] = {"first": v, "last": v}
        by_month[key]["last"] = v
    out: list[MonthCell] = []
    for (y, m), data in sorted(by_month.items()):
        first, last = data["first"], data["last"]
        ret = (last - first) / first if first else 0.0
        out.append(MonthCell(year=y, month=m, ret=ret))
    return out
