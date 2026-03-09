"""Оценка портфелей в базовой валюте (RUB).

Позиции НЕ хранятся отдельно — они выводятся из реестра проведённых транзакций
(`compute_holdings`). Ключевой принцип: рублёвая стоимость КАЖДОЙ ноги фиксируется
в МОМЕНТ сделки по исторической котировке (`Quote` на дату `d`):

    rub(X, qty, d) = nativePrice_X(d) × fx(X.ccy→RUB, d)

Это ловит прибыль от движения валюты (купил BTC за USDT, USDT упал к рублю →
заработал в рублях), которую прежний пересчёт по ТЕКУЩИМ ценам стирал.

Позиция = средневзвешенная база (WAC), зафиксированная на входе, плюс
реализованный P&L:
- in/div/полученная нога свопа → qty += ; cost_rub += rub_at(d).
- out/отданная нога свопа → база списывается пропорционально, фиксируется
  realized_rub += получено_rub(d) − списанная_база.
"""
from __future__ import annotations

import bisect
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from curs_api.models import (
    Asset,
    AssetClass,
    Portfolio,
    Quote,
    Transaction,
    TransactionType,
)

BASE_CCY = "RUB"
_EPS = Decimal("0.000000000001")


# ─── Текущие цены (для оценки остатков «сейчас») ──────────────────────────────
async def rate_to_base(ccy: str) -> Decimal:
    """Курс ccy → RUB СЕЙЧАС. Для RUB = 1; для остальных fiat — current_price."""
    if ccy == BASE_CCY:
        return Decimal(1)
    fiat = await Asset.filter(asset_class=AssetClass.FIAT, ccy=ccy).first()
    if fiat and fiat.current_price:
        return Decimal(fiat.current_price)
    return Decimal(1)


async def price_of(asset: Asset) -> Decimal:
    if asset.current_price is not None:
        return Decimal(asset.current_price)
    return Decimal(0)


async def _unit_value_rub(asset: Asset) -> Decimal:
    """Текущая стоимость 1 единицы актива в рублях."""
    if asset.asset_class == AssetClass.FIAT:
        return await rate_to_base(asset.ccy)
    return await price_of(asset) * await rate_to_base(asset.ccy)


async def value_position_in_base(asset: Asset, qty: Decimal, ccy: str = BASE_CCY) -> Decimal:
    return Decimal(qty) * await unit_value(asset, ccy)


# ─── Стоимости в ВАЛЮТЕ ОТОБРАЖЕНИЯ (ccy), а не обязательно в рублях ──────────
# Принцип: считаем в выбранной валюте пользователя, фиксируя историю в ней же.
#   price_ccy(X, d)   = rub_price_at(X, d) / fx(ccy→RUB, d)
#   unit_value(X)     = rub-цена сейчас   / fx(ccy→RUB сейчас)
# Для ccy=RUB всё сводится к прежним рублёвым функциям.
async def unit_value(asset: Asset, ccy: str = BASE_CCY) -> Decimal:
    """Текущая стоимость 1 единицы актива в валюте ccy."""
    v = await _unit_value_rub(asset)
    if ccy == BASE_CCY:
        return v
    rate = await rate_to_base(ccy)
    return v / rate if rate else v


async def price_at(asset: Asset, when: datetime, ccy: str = BASE_CCY) -> Decimal:
    """Цена 1 единицы актива на дату when в валюте ccy (история зафиксирована в ccy)."""
    p = await rub_price_at(asset, when)
    if ccy == BASE_CCY:
        return p
    fx = await _fx_at(ccy, when)
    return p / fx if fx else p


async def value_at(asset: Asset, qty: Decimal, when: datetime, ccy: str = BASE_CCY) -> Decimal:
    return Decimal(qty) * await price_at(asset, when, ccy)


# ─── Исторические цены (для фиксации базы в момент сделки) ────────────────────
async def _quote_at(asset: Asset, when: datetime) -> Decimal | None:
    """Нативная котировка актива на дату ≤ when (последняя известная).

    Если на дату сделки котировок ещё нет (бэкафилл не дошёл) — берём самую раннюю
    доступную, чтобы оценка не падала в ноль."""
    q = await Quote.filter(asset=asset, ts__lte=when).order_by("-ts").first()
    if q is None:
        q = await Quote.filter(asset=asset).order_by("ts").first()
    return Decimal(q.price) if q else None


async def _fx_at(ccy: str, when: datetime) -> Decimal:
    """Курс ccy → RUB на дату when (исторический). Котировка fiat-актива ИМЕННО и
    есть рублёвый курс (Tinkoff/ЦБ пишут цену USD/EUR в рублях)."""
    if ccy == BASE_CCY:
        return Decimal(1)
    fiat = await Asset.filter(asset_class=AssetClass.FIAT, ccy=ccy).first()
    if fiat:
        q = await _quote_at(fiat, when)
        if q is not None:
            return q
        if fiat.current_price is not None:
            return Decimal(fiat.current_price)
    return Decimal(1)


async def rub_price_at(asset: Asset, when: datetime) -> Decimal:
    """Рублёвая цена 1 единицы актива на дату сделки."""
    if asset.asset_class == AssetClass.FIAT:
        return await _fx_at(asset.ccy, when)
    native = await _quote_at(asset, when)
    if native is None:
        native = Decimal(asset.current_price) if asset.current_price is not None else Decimal(0)
    return native * await _fx_at(asset.ccy, when)


async def rub_value_at(asset: Asset, qty: Decimal, when: datetime) -> Decimal:
    return Decimal(qty) * await rub_price_at(asset, when)


@dataclass
class Holding:
    """Выведенная из транзакций позиция.

    cost_rub — рублёвая база ТЕКУЩИХ остатков (зафиксирована на входе).
    realized_rub — накопленный реализованный P&L по уже проданному/выведенному."""

    asset: Asset
    qty: Decimal = Decimal(0)
    cost_rub: Decimal = Decimal(0)
    realized_rub: Decimal = Decimal(0)


def _legs(tx: Transaction) -> tuple:
    out_leg = next((l for l in tx.legs if l.side == "out"), None)
    in_leg = next((l for l in tx.legs if l.side == "in"), None)
    return out_leg, in_leg


async def _walk_holdings(portfolio: Portfolio, ccy: str = BASE_CCY) -> list[Holding]:
    """Все позиции портфеля (включая закрытые — для реализованного P&L).

    Значения (cost_rub/realized_rub — имена историч.) считаются в валюте ccy.
    Внутри одной даты сделки упорядочиваются по «готовности»: пополнение валюты
    обрабатывается раньше траты этой валюты, даже если внесено позже (одна дата не
    задаёт порядок внутри дня)."""
    txs = (
        await Transaction.filter(portfolio=portfolio)
        .order_by("d", "created_at")
        .prefetch_related("legs__asset", "source_asset", "cash_asset")
    )
    acc: dict[str, Holding] = {}

    def get(asset: Asset) -> Holding:
        h = acc.get(asset.id)
        if h is None:
            h = Holding(asset=asset)
            acc[asset.id] = h
        return h

    def avail(asset_id: str) -> Decimal:
        h = acc.get(asset_id)
        return h.qty if h else Decimal(0)

    def sell(h: Holding, q: Decimal, proceeds_rub: Decimal) -> None:
        """Списать q и зафиксировать реализованную прибыль = выручка − списанная база."""
        cost_removed = Decimal(0)
        if h.qty > 0:
            per = h.cost_rub / h.qty
            cost_removed = per * (q if q < h.qty else h.qty)
            h.cost_rub -= cost_removed
            if h.cost_rub < 0:
                h.cost_rub = Decimal(0)
        h.qty -= q
        h.realized_rub += proceeds_rub - cost_removed

    async def apply(tx: Transaction) -> None:
        when = tx.d
        if tx.type == TransactionType.IN:
            leg = next(iter(tx.legs), None)
            if leg:
                h = get(leg.asset)
                h.qty += leg.qty
                h.cost_rub += await value_at(leg.asset, leg.qty, when, ccy)  # база на дату
        elif tx.type == TransactionType.OUT:
            leg = next(iter(tx.legs), None)
            if leg:
                proceeds = await value_at(leg.asset, leg.qty, when, ccy)
                sell(get(leg.asset), leg.qty, proceeds)  # вывод фиксирует реализованный P&L
        elif tx.type == TransactionType.TX:
            out_leg, in_leg = _legs(tx)
            if out_leg and in_leg:
                # Cost-rollover: рублёвая база отданного актива переносится на полученный.
                # Своп не «реализует» прибыль — это перепозиционирование, P&L остаётся
                # нереализованным до фактического вывода. Прибыль от движения валюты
                # уже зашита в базу (зафиксирована на датах прошлых сделок).
                ho = get(out_leg.asset)
                if ho.qty > 0:
                    per = ho.cost_rub / ho.qty
                    rolled = per * (out_leg.qty if out_leg.qty < ho.qty else ho.qty)
                    ho.cost_rub -= rolled
                    if ho.cost_rub < 0:
                        ho.cost_rub = Decimal(0)
                else:
                    # Нет базы (актив не куплен в портфеле) — оценим обмен по рынку даты.
                    rolled = await value_at(out_leg.asset, out_leg.qty, when, ccy)
                    if rolled <= 0:
                        rolled = await value_at(in_leg.asset, in_leg.qty, when, ccy)
                ho.qty -= out_leg.qty
                hi = get(in_leg.asset)
                hi.qty += in_leg.qty
                hi.cost_rub += rolled
        elif tx.type == TransactionType.DIV:
            if tx.cash_asset and tx.cash_qty is not None:
                qty = Decimal(tx.cash_qty)
                val = await value_at(tx.cash_asset, qty, when, ccy)
                h = get(tx.cash_asset)
                h.qty += qty
                h.cost_rub += val
                h.realized_rub += val  # дивиденд — это доход

    def ready(tx: Transaction) -> bool:
        if tx.type in (TransactionType.IN, TransactionType.DIV):
            return True
        if tx.type == TransactionType.OUT:
            leg = next(iter(tx.legs), None)
            return leg is None or avail(leg.asset.id) + _EPS >= leg.qty
        if tx.type == TransactionType.TX:
            out_leg, _ = _legs(tx)
            return out_leg is None or avail(out_leg.asset.id) + _EPS >= out_leg.qty
        return True

    # Группируем по дате; внутри дня — ready-очередь (funding раньше spending).
    by_day: dict = {}
    for tx in txs:
        by_day.setdefault(tx.d, []).append(tx)
    for day in sorted(by_day):
        pending = by_day[day]
        while pending:
            progressed = False
            rest = []
            for tx in pending:
                if ready(tx):
                    await apply(tx)
                    progressed = True
                else:
                    rest.append(tx)
            pending = rest
            if pending and not progressed:
                await apply(pending.pop(0))  # дедлок (недофинансирование) — форсируем

    return list(acc.values())


async def compute_holdings(portfolio: Portfolio, ccy: str = BASE_CCY) -> list[Holding]:
    """Открытые остатки портфеля (qty > 0). Закрытые позиции отфильтрованы."""
    return [h for h in await _walk_holdings(portfolio, ccy) if abs(h.qty) > _EPS]


async def position_view(h: Holding) -> dict:
    asset = h.asset
    val_base = h.qty * await _unit_value_rub(asset)
    cost_base = h.cost_rub
    unrealized = val_base - cost_base
    realized = h.realized_rub
    total_pl = unrealized + realized
    pl_pct = float(unrealized / cost_base) if cost_base > 0 else 0.0
    # Средняя цена входа — в рублях за единицу (всё считается в рублях).
    avg_rub = (h.cost_rub / h.qty) if h.qty else Decimal(0)
    return {
        "asset": asset,
        "qty": float(h.qty),
        "avg_price": float(avg_rub),
        "val_base": float(val_base),
        "cost_base": float(cost_base),
        "pl": float(total_pl),
        "unrealized_pl": float(unrealized),
        "realized_pl": float(realized),
        "pl_pct": pl_pct,
        "day_pct": 0.0,  # TODO Stage 3 — из истории котировок
    }


# ─── Лотовые позиции (from→to, с жизненным циклом open/closed) ────────────────
@dataclass
class Position:
    """Позиция = пара from→to с порядковым номером (#seq) внутри пары.

    Открывается покупкой to за from; обратная сделка (продажа to за from) — выход.
    Когда qty (остаток to) обнуляется — позиция закрывается и больше не пополняется;
    следующая покупка той же пары открывает новую позицию со seq+1."""

    seq: int
    from_asset: Asset
    to_asset: Asset
    qty: Decimal = Decimal(0)          # текущий остаток `to`
    qty_bought: Decimal = Decimal(0)   # всего куплено `to`
    qty_sold: Decimal = Decimal(0)     # всего продано `to` (выходы)
    invested_rub: Decimal = Decimal(0) # суммарно вложено (RUB, по датам покупок)
    redeployed_cost_rub: Decimal = Decimal(0)  # база, ушедшая на финансирование других позиций
    proceeds_rub: Decimal = Decimal(0) # суммарно получено с продаж (RUB, по датам)
    cost_rub: Decimal = Decimal(0)     # рублёвая база ОСТАТКА `to`
    realized_rub: Decimal = Decimal(0)
    closed: bool = False
    order: int = 0                     # хронологический порядок открытия (для сортировки)


async def compute_positions(portfolio: Portfolio, ccy: str = BASE_CCY) -> list[Position]:
    """Лотовые позиции (Вариант 2 — связанные позиции). Все суммы — в валюте ccy.

    Покупка B за A списывает A из открытых позиций, держащих A (FIFO), перенося их
    рублёвую базу в новую позицию; недостаток финансируется наличными/по рынку.
    Позиция закрывается, когда её `to` обнуляется — обратной продажей ИЛИ полным
    перекладыванием в другой актив (тогда qty_sold=0 → «переложена»).

    Внутри одной даты сделки упорядочиваются ready-очередью: трата актива ждёт, пока
    он не появится (одна дата не задаёт внутридневной порядок)."""
    txs = (
        await Transaction.filter(portfolio=portfolio)
        .order_by("d", "created_at")
        .prefetch_related("legs__asset", "source_asset", "cash_asset")
    )
    positions: list[Position] = []
    pair_seq: dict[tuple[str, str], int] = {}
    cash: dict[str, Decimal] = {}
    order = 0

    def open_pos(from_a: Asset, to_a: Asset) -> Position:
        nonlocal order
        key = (from_a.id, to_a.id)
        pair_seq[key] = pair_seq.get(key, 0) + 1
        order += 1
        p = Position(seq=pair_seq[key], from_asset=from_a, to_asset=to_a, order=order)
        positions.append(p)
        return p

    def find_open(from_id: str, to_id: str) -> Position | None:
        for p in positions:
            if not p.closed and p.from_asset.id == from_id and p.to_asset.id == to_id:
                return p
        return None

    def held(asset_id: str) -> Decimal:
        return sum((p.qty for p in positions if not p.closed and p.to_asset.id == asset_id), Decimal(0))

    def avail(asset_id: str) -> Decimal:
        return cash.get(asset_id, Decimal(0)) + held(asset_id)

    async def apply(tx: Transaction) -> None:
        when = tx.d
        if tx.type == TransactionType.IN:
            leg = next(iter(tx.legs), None)
            if leg:
                cash[leg.asset.id] = cash.get(leg.asset.id, Decimal(0)) + leg.qty
            return
        if tx.type == TransactionType.OUT:
            leg = next(iter(tx.legs), None)
            if leg:
                cash[leg.asset.id] = cash.get(leg.asset.id, Decimal(0)) - leg.qty
            return
        if tx.type == TransactionType.DIV:
            if tx.cash_asset and tx.cash_qty is not None:
                cid = tx.cash_asset.id
                cash[cid] = cash.get(cid, Decimal(0)) + Decimal(tx.cash_qty)
            return

        out_leg, in_leg = _legs(tx)
        if not (out_leg and in_leg):
            return
        a, qa = out_leg.asset, out_leg.qty   # отдаём A
        b, qb = in_leg.asset, in_leg.qty     # получаем B

        # Выход: открытая позиция (from=B, to=A) → продаём её `to`(=A), получаем `from`(=B).
        ex = find_open(b.id, a.id)
        if ex is not None and ex.qty > 0:
            sell_qty = qa if qa < ex.qty else ex.qty
            proceeds = await value_at(b, qb, when, ccy)
            if qa > 0 and sell_qty < qa:
                proceeds = proceeds * (sell_qty / qa)
            removed = ex.cost_rub / ex.qty * sell_qty if ex.qty > 0 else Decimal(0)
            ex.cost_rub -= removed
            if ex.cost_rub < 0:
                ex.cost_rub = Decimal(0)
            ex.qty -= sell_qty
            ex.qty_sold += sell_qty
            ex.proceeds_rub += proceeds
            ex.realized_rub += proceeds - removed
            if ex.qty <= _EPS:
                ex.qty = Decimal(0)
                ex.closed = True
            cash[b.id] = cash.get(b.id, Decimal(0)) + qb  # выручка становится наличными
            return

        # Покупка B за A: списываем A из позиций (FIFO, с переносом базы), затем из наличных.
        remaining = qa
        acquired = Decimal(0)
        for fp in positions:
            if remaining <= _EPS:
                break
            if fp.closed or fp.to_asset.id != a.id or fp.qty <= 0:
                continue
            take = fp.qty if fp.qty < remaining else remaining
            cost_taken = fp.cost_rub / fp.qty * take
            fp.cost_rub -= cost_taken
            if fp.cost_rub < 0:
                fp.cost_rub = Decimal(0)
            fp.qty -= take
            fp.redeployed_cost_rub += cost_taken  # эта база ушла в дочернюю позицию
            acquired += cost_taken
            remaining -= take
            if fp.qty <= _EPS:
                fp.qty = Decimal(0)
                fp.closed = True  # переложена (если без обратных продаж)
        if remaining > _EPS:
            take_cash = cash.get(a.id, Decimal(0))
            if take_cash > remaining:
                take_cash = remaining
            if take_cash > 0:
                acquired += await value_at(a, take_cash, when, ccy)
                cash[a.id] = cash.get(a.id, Decimal(0)) - take_cash
                remaining -= take_cash
            if remaining > _EPS:  # недофинансировано — добираем по рынку
                acquired += await value_at(a, remaining, when, ccy)
                remaining = Decimal(0)

        p = find_open(a.id, b.id) or open_pos(a, b)
        p.qty += qb
        p.qty_bought += qb
        p.invested_rub += acquired
        p.cost_rub += acquired

    def ready(tx: Transaction) -> bool:
        if tx.type in (TransactionType.IN, TransactionType.OUT, TransactionType.DIV):
            return True
        out_leg, _ = _legs(tx)
        return out_leg is None or avail(out_leg.asset.id) + _EPS >= out_leg.qty

    by_day: dict = {}
    for tx in txs:
        by_day.setdefault(tx.d, []).append(tx)
    for day in sorted(by_day):
        pending = by_day[day]
        while pending:
            progressed = False
            rest = []
            for tx in pending:
                if ready(tx):
                    await apply(tx)
                    progressed = True
                else:
                    rest.append(tx)
            pending = rest
            if pending and not progressed:
                await apply(pending.pop(0))  # дедлок (недофинансирование) — форсируем

    return positions


async def position_lot_view(p: Position, ccy: str = BASE_CCY) -> dict:
    """База представления позиции (в валюте ccy). `share` и `planned_pl` добавляет
    роут (нужны суммарная стоимость позиций и планы портфеля)."""
    asset = p.to_asset
    val_base = p.qty * await unit_value(asset, ccy)
    unrealized = val_base - p.cost_rub
    realized = p.realized_rub
    pl = realized + unrealized
    avg_rub = (p.invested_rub / p.qty_bought) if p.qty_bought else Decimal(0)
    avg_close_rub = (p.proceeds_rub / p.qty_sold) if p.qty_sold else Decimal(0)
    # Эффективно вложено = всего вложено − ушедшее на финансирование других позиций.
    # (база перепозиционированного `to` уехала в дочернюю позицию, тут её уже нет).
    invested = p.invested_rub - p.redeployed_cost_rub
    if invested < 0:
        invested = Decimal(0)
    pl_pct = float(pl / invested) if invested > _EPS else 0.0
    return {
        "seq": p.seq,
        "from_asset": p.from_asset,
        "to_asset": asset,
        "closed": p.closed,
        # «переложена» — закрыта перекладыванием в другой актив (без обратных продаж).
        "redeployed": p.closed and p.qty_sold <= _EPS,
        "qty": float(p.qty),
        "avg_price": float(avg_rub),
        "avg_close": float(avg_close_rub),
        "val_base": float(val_base),
        "cost_base": float(invested),
        "pl": float(pl),
        "unrealized_pl": float(unrealized),
        "realized_pl": float(realized),
        "pl_pct": pl_pct,
    }


async def portfolio_totals(portfolio: Portfolio, ccy: str = BASE_CCY) -> dict:
    holdings = await _walk_holdings(portfolio, ccy)
    total = Decimal(0)
    total_cost = Decimal(0)
    realized = Decimal(0)
    for h in holdings:
        realized += h.realized_rub
        if abs(h.qty) > _EPS:
            total += h.qty * await unit_value(h.asset, ccy)
            total_cost += h.cost_rub
    unrealized = total - total_cost
    pl = unrealized + realized
    return {
        "total": float(total),
        "total_cost": float(total_cost),
        "pl": float(pl),
        "unrealized_pl": float(unrealized),
        "realized_pl": float(realized),
        "pl_pct": float(pl / total_cost) if total_cost > 0 else 0.0,
    }


async def _daily_close_rub(asset: Asset) -> list[tuple[date, Decimal]]:
    """Котировки актива, схлопнутые до ОДНОЙ цены за день (последняя в дне), в нативной
    валюте актива. Восходящий порядок ts → в словаре остаётся последняя сделка дня."""
    rows = await Quote.filter(asset=asset).order_by("ts").values("ts", "price")
    by_day: dict[date, Decimal] = {}
    for r in rows:
        by_day[r["ts"].date()] = Decimal(r["price"])  # ascending → last wins
    return sorted(by_day.items())


def _ffill(days: list[date], vals: list[Decimal], when: date) -> Decimal | None:
    """Значение на дату when с протяжкой назад: последняя котировка с днём ≤ when;
    до самой ранней котировки — берём раннюю (чтобы график не падал в ноль)."""
    if not vals:
        return None
    pos = bisect.bisect_right(days, when) - 1
    return vals[pos] if pos >= 0 else vals[0]


async def portfolio_series_from_quotes(portfolio: Portfolio, *, days: int, ccy: str = BASE_CCY) -> list[dict]:
    """Дневной ряд стоимости портфеля: ТЕКУЩИЕ остатки × историческая котировка дня.

    Для каждого календарного дня окна каждый актив оценивается по последней известной
    котировке (протяжка назад), поэтому в дне участвуют ВСЕ активы, не только те, у кого
    в этот день была сделка. Ровно одна цена за день на актив. Сумма в рублях делится на
    текущий курс ccy — значения выходят в валюте отображения, а в «сегодня» сходятся со
    `portfolio_totals.total`.

    Если quotes ещё не заполнены воркерами — оценка падает на текущую цену (плоско)."""
    holdings = await compute_holdings(portfolio, ccy)
    held = [h for h in holdings if abs(h.qty) > _EPS]
    if not held:
        return []

    base_div = await rate_to_base(ccy)  # RUB → ccy сейчас (для ccy=RUB = 1)
    div = base_div if base_div else Decimal(1)
    today = datetime.now(timezone.utc).date()
    start = (datetime.now(timezone.utc) - timedelta(days=days)).date()

    # Дневной курс fiat-валюты → RUB (для конвертации нативных цен крипты/акций).
    fx_cache: dict[str, tuple[list[date], list[Decimal]]] = {}

    async def fx_daily(code: str) -> tuple[list[date], list[Decimal]]:
        if code not in fx_cache:
            fiat = await Asset.filter(asset_class=AssetClass.FIAT, ccy=code).first()
            series = await _daily_close_rub(fiat) if fiat else []
            fx_cache[code] = ([d for d, _ in series], [v for _, v in series])
        return fx_cache[code]

    # Для каждого актива — рублёвая дневная цена (days[], vals[]) + запасная текущая цена.
    asset_series: list[tuple[Decimal, list[date], list[Decimal], Decimal]] = []
    for h in held:
        a = h.asset
        fallback_rub = await _unit_value_rub(a)  # если истории нет — плоско по текущей
        if a.asset_class == AssetClass.FIAT:
            if a.ccy == BASE_CCY:
                asset_series.append((h.qty, [], [], Decimal(1)))  # рубль — цена 1
                continue
            fxd, fxv = await fx_daily(a.ccy)  # котировка fiat-актива = его курс к ₽
            asset_series.append((h.qty, fxd, fxv, fallback_rub))
            continue
        native = await _daily_close_rub(a)
        if a.ccy == BASE_CCY:
            d_arr = [d for d, _ in native]
            v_arr = [v for _, v in native]
        else:
            fxd, fxv = await fx_daily(a.ccy)
            d_arr, v_arr = [], []
            for d, nv in native:
                fx = _ffill(fxd, fxv, d) or Decimal(1)
                d_arr.append(d)
                v_arr.append(nv * fx)
        asset_series.append((h.qty, d_arr, v_arr, fallback_rub))

    points: list[dict] = []
    day = start
    one = timedelta(days=1)
    while day <= today:
        total_rub = Decimal(0)
        for qty, d_arr, v_arr, fallback in asset_series:
            # «Сегодня» оцениваем по ТЕКУЩЕЙ цене — точка сходится с portfolio_totals.
            if day == today or not d_arr:
                price = fallback
            else:
                price = _ffill(d_arr, v_arr, day)
                if price is None:
                    price = fallback
            total_rub += qty * price
        points.append({"d": day.isoformat(), "v": float(total_rub / div)})
        day += one

    return points


async def portfolio_pnl_series(portfolio: Portfolio, *, ccy: str = BASE_CCY) -> list[dict]:
    """P&L портфеля по дням ОТ ПЕРВОЙ ТРАНЗАКЦИИ до сегодня, в валюте ccy.

    P&L(d) = стоимость остатков на конец дня d (по котировкам дня) − чистый вложенный
    капитал к дню d. Капитал = депозиты (IN) минус выводы (OUT), зафиксированные в ccy на
    свои даты; своп (TX) капитал не меняет, дивиденд (DIV) — доход (растит стоимость, не
    капитал). В день создания портфеля P&L = 0; далее кривая движется с ценами и сделками.
    Последняя точка прибивается к `portfolio_totals.pl`, чтобы конец графика совпадал с
    показателем «P&L (общий)» в шапке."""
    txs = (
        await Transaction.filter(portfolio=portfolio)
        .order_by("d", "created_at")
        .prefetch_related("legs__asset", "cash_asset")
    )
    if not txs:
        return []

    today = datetime.now(timezone.utc).date()
    first_day = min(t.d for t in txs).date()
    if first_day > today:
        first_day = today

    fx_cache: dict[str, tuple[list[date], list[Decimal]]] = {}

    async def fx_daily(code: str) -> tuple[list[date], list[Decimal]]:
        if code not in fx_cache:
            fiat = await Asset.filter(asset_class=AssetClass.FIAT, ccy=code).first()
            series = await _daily_close_rub(fiat) if fiat else []
            fx_cache[code] = ([d for d, _ in series], [v for _, v in series])
        return fx_cache[code]

    # Рублёвая дневная цена каждого затронутого актива + текущая (для точки «сегодня»).
    assets: dict[str, Asset] = {}
    for t in txs:
        for l in t.legs:
            assets[l.asset.id] = l.asset
        if t.cash_asset:
            assets[t.cash_asset.id] = t.cash_asset
    rub_series: dict[str, tuple[list[date], list[Decimal]]] = {}
    live_rub: dict[str, Decimal] = {}
    for aid, a in assets.items():
        live_rub[aid] = await _unit_value_rub(a)
        if a.asset_class == AssetClass.FIAT:
            rub_series[aid] = ([], []) if a.ccy == BASE_CCY else await fx_daily(a.ccy)
            continue
        native = await _daily_close_rub(a)
        if a.ccy == BASE_CCY:
            rub_series[aid] = ([d for d, _ in native], [v for _, v in native])
        else:
            fxd, fxv = await fx_daily(a.ccy)
            ds = [d for d, _ in native]
            vs = [nv * (_ffill(fxd, fxv, d) or Decimal(1)) for d, nv in native]
            rub_series[aid] = (ds, vs)

    # Курс валюты отображения по дням (рублёвую стоимость переводим в ccy на дату дня).
    disp_base = ccy == BASE_CCY
    disp_fxd, disp_fxv = ([], []) if disp_base else await fx_daily(ccy)
    cur_disp_fx = (await rate_to_base(ccy)) or Decimal(1)

    def disp_fx(day: date) -> Decimal:
        if disp_base:
            return Decimal(1)
        return _ffill(disp_fxd, disp_fxv, day) or cur_disp_fx

    # Дневные изменения остатков (dqty) и вложенного капитала (dcap, в ccy).
    dqty: dict[date, dict[str, Decimal]] = defaultdict(lambda: defaultdict(Decimal))
    dcap: dict[date, Decimal] = defaultdict(Decimal)
    for t in txs:
        day = t.d.date()
        if t.type == TransactionType.IN:
            leg = next(iter(t.legs), None)
            if leg:
                dqty[day][leg.asset.id] += leg.qty
                dcap[day] += await value_at(leg.asset, leg.qty, t.d, ccy)
        elif t.type == TransactionType.OUT:
            leg = next(iter(t.legs), None)
            if leg:
                dqty[day][leg.asset.id] -= leg.qty
                dcap[day] -= await value_at(leg.asset, leg.qty, t.d, ccy)
        elif t.type == TransactionType.TX:
            out_leg, in_leg = _legs(t)
            if out_leg:
                dqty[day][out_leg.asset.id] -= out_leg.qty
            if in_leg:
                dqty[day][in_leg.asset.id] += in_leg.qty
        elif t.type == TransactionType.DIV:
            if t.cash_asset and t.cash_qty is not None:
                dqty[day][t.cash_asset.id] += Decimal(t.cash_qty)  # доход, не капитал

    qty: dict[str, Decimal] = defaultdict(Decimal)
    capital = Decimal(0)
    points: list[dict] = []
    day = first_day
    one = timedelta(days=1)
    while day <= today:
        for aid, dq in dqty.get(day, {}).items():
            qty[aid] += dq
        capital += dcap.get(day, Decimal(0))
        val_ccy = Decimal(0)
        for aid, q in qty.items():
            if abs(q) <= _EPS:
                continue
            if day == today:
                val_ccy += q * live_rub[aid] / cur_disp_fx
            else:
                ds, vs = rub_series[aid]
                rub = (_ffill(ds, vs, day) if ds else None) or live_rub[aid]
                val_ccy += q * rub / disp_fx(day)
        points.append({"d": day.isoformat(), "v": float(val_ccy - capital)})
        day += one

    if points:
        totals = await portfolio_totals(portfolio, ccy)
        points[-1]["v"] = totals["pl"]  # конец графика == «P&L (общий)»
    return points


# Стейблкоины считаем «кэшем» наряду с фиатом — для классификации сделок buy/sell.
_STABLES = {"USDT", "USDC", "DAI", "TUSD", "BUSD", "FDUSD"}


def _cash_like(asset: Asset) -> bool:
    return asset.asset_class == AssetClass.FIAT or asset.id in _STABLES


async def trade_markers(portfolio: Portfolio) -> list[dict]:
    """Точки сделок для графика: [{d, kind: "buy"|"sell"}]. Только свопы (TX) — депозиты,
    выводы и дивиденды сделками не считаются. Продажа = отдаём рисковый актив за
    кэш/стейбл; всё остальное (вход в риск, конвертация кэша) — покупка."""
    txs = (
        await Transaction.filter(portfolio=portfolio, type=TransactionType.TX)
        .order_by("d", "created_at")
        .prefetch_related("legs__asset")
    )
    markers: list[dict] = []
    for t in txs:
        out_leg, in_leg = _legs(t)
        if not (out_leg and in_leg):
            continue
        kind = "sell" if (_cash_like(in_leg.asset) and not _cash_like(out_leg.asset)) else "buy"
        markers.append(
            {
                "d": t.d.date().isoformat(),
                "kind": kind,
                "from_asset": out_leg.asset.id,
                "to_asset": in_leg.asset.id,
                "from_qty": float(out_leg.qty),
                "to_qty": float(in_leg.qty),
            }
        )
    return markers
