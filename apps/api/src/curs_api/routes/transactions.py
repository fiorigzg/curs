from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import TypeAdapter, ValidationError
from tortoise.transactions import in_transaction

from curs_api.deps import get_current_user
from curs_api.models import Asset, Portfolio, Transaction, TransactionLeg, TransactionType, User
from curs_api.schemas.transaction import (
    TransactionIn,
    TxDiv,
    TxIn,
    TxOut,
    TxRowOut,
    TxSwap,
)

router = APIRouter(prefix="/transactions", tags=["transactions"])

_tx_adapter = TypeAdapter(TransactionIn)


@router.get("", response_model=list[TxRowOut])
async def list_transactions(
    portfolio: UUID | None = None,
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user),
) -> list[TxRowOut]:
    qs = Transaction.filter(portfolio__user=user)
    if portfolio:
        qs = qs.filter(portfolio_id=portfolio)
    rows = (
        await qs.order_by("-d", "-created_at")
        .offset(offset)
        .limit(limit)
        .prefetch_related("legs__asset", "source_asset", "cash_asset")
    )
    return [_serialize_tx(t) for t in rows]


@router.post("", response_model=TxRowOut, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    raw: dict[str, Any], user: User = Depends(get_current_user)
) -> TxRowOut:
    try:
        parsed = _tx_adapter.validate_python(raw)
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=exc.errors()
        ) from exc
    tx = await _persist_tx(parsed, user)
    return _serialize_tx(tx)


@router.post("/batch", response_model=list[TxRowOut], status_code=status.HTTP_201_CREATED)
async def create_batch(
    raw_list: list[dict[str, Any]], user: User = Depends(get_current_user)
) -> list[TxRowOut]:
    out = []
    async with in_transaction():
        for raw in raw_list:
            try:
                parsed = _tx_adapter.validate_python(raw)
            except ValidationError as exc:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=exc.errors()
                ) from exc
            tx = await _persist_tx(parsed, user)
            out.append(_serialize_tx(tx))
    return out


@router.put("/{tx_id}", response_model=TxRowOut)
async def update_transaction(
    tx_id: UUID, raw: dict[str, Any], user: User = Depends(get_current_user)
) -> TxRowOut:
    try:
        parsed = _tx_adapter.validate_python(raw)
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=exc.errors()
        ) from exc
    tx = await Transaction.get_or_none(id=tx_id, portfolio__user=user)
    if not tx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="tx_not_found")
    portfolio = await Portfolio.get_or_none(id=parsed.portfolio, user=user)
    if not portfolio:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="portfolio_not_found")

    async with in_transaction():
        tx.portfolio = portfolio
        tx.d = parsed.d
        await _apply_tx_payload(tx, parsed)
    await tx.fetch_related("legs__asset", "source_asset", "cash_asset")
    return _serialize_tx(tx)


@router.delete("/{tx_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(tx_id: UUID, user: User = Depends(get_current_user)) -> None:
    tx = await Transaction.get_or_none(id=tx_id, portfolio__user=user)
    if not tx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="tx_not_found")
    await tx.delete()


async def _persist_tx(parsed: TransactionIn, user: User) -> Transaction:
    portfolio = await Portfolio.get_or_none(id=parsed.portfolio, user=user)
    if not portfolio:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="portfolio_not_found")

    async with in_transaction():
        tx = Transaction(portfolio=portfolio, type=TransactionType.TX, d=parsed.d)
        await tx.save()
        await _apply_tx_payload(tx, parsed)
    await tx.fetch_related("legs__asset", "source_asset", "cash_asset")
    return tx


async def _apply_tx_payload(tx: Transaction, parsed: TransactionIn) -> None:
    """Перезаписывает тип/ноги/div-поля уже сохранённой tx под конкретную форму.

    Старые ноги и div-поля сбрасываются — годится и для create (нет ног), и для
    update (тип сделки может смениться, напр. in → tx)."""
    await TransactionLeg.filter(transaction=tx).delete()
    tx.source_asset = None
    tx.cash_asset = None
    tx.cash_qty = None

    if isinstance(parsed, (TxIn, TxOut)):
        asset = await _require_asset(parsed.asset)
        tx.type = TransactionType(parsed.type)
        await tx.save()
        await TransactionLeg.create(transaction=tx, asset=asset, qty=parsed.qty, side=parsed.type)
    elif isinstance(parsed, TxSwap):
        from_asset = await _require_asset(parsed.from_.asset)
        to_asset = await _require_asset(parsed.to.asset)
        tx.type = TransactionType.TX
        await tx.save()
        await TransactionLeg.create(
            transaction=tx, asset=from_asset, qty=parsed.from_.qty, side="out"
        )
        await TransactionLeg.create(
            transaction=tx, asset=to_asset, qty=parsed.to.qty, side="in"
        )
    elif isinstance(parsed, TxDiv):
        src = await _require_asset(parsed.source)
        cash = await _require_asset(parsed.cash_asset)
        tx.type = TransactionType.DIV
        tx.source_asset = src
        tx.cash_asset = cash
        tx.cash_qty = parsed.qty
        await tx.save()
    else:
        raise HTTPException(status_code=400, detail="unknown_tx_type")


async def _require_asset(asset_id: str) -> Asset:
    a = await Asset.get_or_none(id=asset_id.upper())
    if not a:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"asset_not_found:{asset_id}"
        )
    return a


def _serialize_tx(t: Transaction) -> TxRowOut:
    base = {"id": t.id, "type": str(t.type), "portfolio": t.portfolio_id, "d": t.d}
    if t.type in (TransactionType.IN, TransactionType.OUT):
        leg = next(iter(t.legs), None)
        if leg:
            base["asset"] = leg.asset.id
            base["qty"] = float(leg.qty)
    elif t.type == TransactionType.TX:
        out_leg = next((l for l in t.legs if l.side == "out"), None)
        in_leg = next((l for l in t.legs if l.side == "in"), None)
        if out_leg and in_leg:
            base["from_"] = {"asset": out_leg.asset.id, "qty": float(out_leg.qty)}
            base["to"] = {"asset": in_leg.asset.id, "qty": float(in_leg.qty)}
    elif t.type == TransactionType.DIV:
        base["source"] = t.source_asset.id if t.source_asset else None
        base["cash_asset"] = t.cash_asset.id if t.cash_asset else None
        base["qty"] = float(t.cash_qty) if t.cash_qty is not None else None
    return TxRowOut.model_validate(base)
