"""Корректировка цен на дивиденды (total return / adjusted close).

Reference: метод обратной корректировки (CRSP / Yahoo Finance). Скорректированная
цена строится так, чтобы доходности, посчитанные по adj_close, включали
реинвестирование дивидендов:

    factor_t = 1 − D_t / close_{t-1}       (для дня с экс-дивидендом D_t)
    adj_close_d = close_d × ∏_{t : ex_date_t > d} factor_t

То есть исторические цены умножаются на накопленное произведение БУДУЩИХ
дивидендных факторов; последняя цена (после всех дивидендов) остаётся равной
raw close. Доходность r_t = adj_close_t / adj_close_{t-1} − 1 тогда учитывает
и движение цены, и дивиденды (см. docs/analytics.md).
"""
from __future__ import annotations

from collections.abc import Sequence
from datetime import date


def adjusted_close_series(
    dates: Sequence[date],
    closes: Sequence[float],
    dividends: Sequence[tuple[date, float]],
) -> list[float]:
    """Возвращает adj_close для каждого дня ряда (по возрастанию дат).

    Параметры:
      dates     — отсортированные по возрастанию торговые дни
      closes    — raw close на эти дни (та же длина)
      dividends — [(ex_date, amount_per_share), ...]; порядок произвольный

    Если дивидендов нет — adj_close == close. Дивиденды с неизвестной/нулевой
    предыдущей ценой игнорируются (factor=1), чтобы не делить на ноль.
    """
    n = len(dates)
    if n == 0 or len(closes) != n:
        return list(closes)
    if not dividends:
        return [float(c) for c in closes]

    # Индекс дня по дате для поиска close_{t-1} на экс-дату.
    idx_by_date = {d: i for i, d in enumerate(dates)}

    # factor на каждый день, где есть экс-дивиденд (по позиции дня в ряду).
    factor_at: dict[int, float] = {}
    for ex_date, amount in dividends:
        if amount is None or amount <= 0:
            continue
        i = idx_by_date.get(ex_date)
        # Нужна цена предыдущего торгового дня. Если экс-дата вне ряда или это
        # первый день — пропускаем (нет базы для factor).
        if i is None or i == 0:
            continue
        prev_close = float(closes[i - 1])
        if prev_close <= 0:
            continue
        f = 1.0 - float(amount) / prev_close
        if f <= 0:
            continue  # дивиденд ≥ цены — аномалия, пропускаем
        factor_at[i] = factor_at.get(i, 1.0) * f

    # adj_close_d = close_d × ∏_{t>d} factor_t. Идём с конца, накапливая произведение.
    out = [0.0] * n
    cum = 1.0
    for d in range(n - 1, -1, -1):
        out[d] = float(closes[d]) * cum
        if d in factor_at:
            cum *= factor_at[d]
    return out
