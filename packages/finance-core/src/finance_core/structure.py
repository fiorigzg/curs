"""Агрегации структуры портфеля для treemap, donut."""
from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass

# Палитра в порядке (--c1..--c10) из styles.css.
TREEMAP_PALETTE = [
    "#15140F", "#2F4858", "#86B0A0", "#D7E041", "#EE7544",
    "#4F6BED", "#B58300", "#8C5BD7", "#1F8F6F", "#C0392B",
    "#4A4842", "#B5B1A6",
]


@dataclass
class StructureItem:
    label: str
    value: float
    share: float
    color: str


def treemap_items(
    positions: Iterable[tuple[str, float]], *, top_n: int = 12
) -> list[StructureItem]:
    """positions: список (label, value_in_base). Берёт топ-N по value."""
    items = sorted(positions, key=lambda x: x[1], reverse=True)[:top_n]
    total = sum(v for _, v in items) or 1.0
    return [
        StructureItem(
            label=lbl, value=v, share=v / total, color=TREEMAP_PALETTE[i % len(TREEMAP_PALETTE)]
        )
        for i, (lbl, v) in enumerate(items)
    ]


def by_class(positions: Iterable[tuple[str, float]]) -> dict[str, float]:
    """positions: список (class, value). Возвращает {class: total}."""
    out: dict[str, float] = {}
    for cls, v in positions:
        out[cls] = out.get(cls, 0.0) + v
    return out
