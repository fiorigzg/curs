from datetime import datetime
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from tortoise.transactions import in_transaction

from curs_api.deps import get_current_user
from curs_api.models import (
    Asset,
    PlanType,
    Portfolio,
    Transaction,
    TransactionLeg,
    TransactionPlan,
    TransactionType,
    User,
)
from curs_api.schemas.plan import PlanDraft, PlanOut
from curs_api.schemas.transaction import TxRowOut
from curs_api.routes.transactions import _serialize_tx  # reuse serializer

router = APIRouter(prefix="/users/me/plans", tags=["plans"])


def _plan_to_dict(p: TransactionPlan) -> dict:
    return {
        "id": p.id,
        "type": str(p.type),
        "portfolio_id": p.portfolio_id,
        "d": p.d,
        "asset_id": p.asset_id,
        "qty": float(p.qty) if p.qty is not None else None,
        "price": float(p.price) if p.price is not None else None,
        "cash_asset": p.cash_asset_id,
        "from_asset": p.from_asset_id,
        "from_qty": float(p.from_qty) if p.from_qty is not None else None,
        "to_asset": p.to_asset_id,
        "to_qty": float(p.to_qty) if p.to_qty is not None else None,
        "source": p.source_asset_id,
    }


async def _validate_portfolio(user: User, portfolio_id: UUID) -> Portfolio:
    p = await Portfolio.get_or_none(id=portfolio_id, user=user)
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="portfolio_not_found")
    return p


async def _persist_plan(body: PlanDraft, user: User, existing: TransactionPlan | None = None) -> TransactionPlan:
    portfolio = await _validate_portfolio(user, body.portfolio_id)

    async def _resolve(asset_id: str | None) -> Asset | None:
        if not asset_id:
            return None
        a = await Asset.get_or_none(id=asset_id.upper())
        if not a:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=f"asset_not_found:{asset_id}"
            )
        return a

    fields = {
        "user": user,
        "portfolio": portfolio,
        "type": PlanType(body.type),
        "d": body.d,
        "asset": await _resolve(body.asset_id),
        "qty": body.qty,
        "price": body.price,
        "cash_asset": await _resolve(body.cash_asset),
        "from_asset": await _resolve(body.from_asset),
        "from_qty": body.from_qty,
        "to_asset": await _resolve(body.to_asset),
        "to_qty": body.to_qty,
        "source_asset": await _resolve(body.source),
    }
    if existing:
        for k, v in fields.items():
            setattr(existing, k, v)
        await existing.save()
        return existing
    return await TransactionPlan.create(**fields)


@router.get("", response_model=list[PlanOut])
async def list_plans(user: User = Depends(get_current_user)) -> list[PlanOut]:
    plans = await TransactionPlan.filter(user=user).order_by("d", "created_at")
    return [PlanOut.model_validate(_plan_to_dict(p)) for p in plans]


@router.post("", response_model=PlanOut, status_code=status.HTTP_201_CREATED)
async def create_plan(body: PlanDraft, user: User = Depends(get_current_user)) -> PlanOut:
    p = await _persist_plan(body, user)
    return PlanOut.model_validate(_plan_to_dict(p))


@router.put("/{plan_id}", response_model=PlanOut)
async def update_plan(
    plan_id: UUID, body: PlanDraft, user: User = Depends(get_current_user)
) -> PlanOut:
    p = await TransactionPlan.get_or_none(id=plan_id, user=user)
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="plan_not_found")
    p = await _persist_plan(body, user, existing=p)
    return PlanOut.model_validate(_plan_to_dict(p))


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_plan(plan_id: UUID, user: User = Depends(get_current_user)) -> None:
    p = await TransactionPlan.get_or_none(id=plan_id, user=user)
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="plan_not_found")
    await p.delete()


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def delete_all_plans(user: User = Depends(get_current_user)) -> None:
    await TransactionPlan.filter(user=user).delete()


async def _plan_to_tx(plan: TransactionPlan) -> Transaction:
    """Конвертация плана → реальная сделка по правилам из дизайна."""
    when = datetime.combine(plan.d, datetime.min.time())
    async with in_transaction():
        if plan.type == PlanType.BUY:
            if not (plan.asset_id and plan.cash_asset_id and plan.qty and plan.price):
                raise HTTPException(status_code=400, detail="plan_invalid:buy")
            tx = await Transaction.create(portfolio=plan.portfolio, type=TransactionType.TX, d=when)
            await TransactionLeg.create(
                transaction=tx,
                asset=await Asset.get(id=plan.cash_asset_id),
                qty=Decimal(plan.qty) * Decimal(plan.price),
                side="out",
            )
            await TransactionLeg.create(
                transaction=tx,
                asset=await Asset.get(id=plan.asset_id),
                qty=plan.qty,
                side="in",
            )
        elif plan.type == PlanType.SELL:
            if not (plan.asset_id and plan.cash_asset_id and plan.qty and plan.price):
                raise HTTPException(status_code=400, detail="plan_invalid:sell")
            tx = await Transaction.create(portfolio=plan.portfolio, type=TransactionType.TX, d=when)
            await TransactionLeg.create(
                transaction=tx,
                asset=await Asset.get(id=plan.asset_id),
                qty=plan.qty,
                side="out",
            )
            await TransactionLeg.create(
                transaction=tx,
                asset=await Asset.get(id=plan.cash_asset_id),
                qty=Decimal(plan.qty) * Decimal(plan.price),
                side="in",
            )
        elif plan.type == PlanType.TX:
            if not (plan.from_asset_id and plan.to_asset_id and plan.from_qty and plan.to_qty):
                raise HTTPException(status_code=400, detail="plan_invalid:tx")
            tx = await Transaction.create(portfolio=plan.portfolio, type=TransactionType.TX, d=when)
            await TransactionLeg.create(
                transaction=tx,
                asset=await Asset.get(id=plan.from_asset_id),
                qty=plan.from_qty,
                side="out",
            )
            await TransactionLeg.create(
                transaction=tx,
                asset=await Asset.get(id=plan.to_asset_id),
                qty=plan.to_qty,
                side="in",
            )
        elif plan.type in (PlanType.IN, PlanType.OUT):
            if not (plan.asset_id and plan.qty):
                raise HTTPException(status_code=400, detail="plan_invalid:in_out")
            tx_type = TransactionType.IN if plan.type == PlanType.IN else TransactionType.OUT
            tx = await Transaction.create(portfolio=plan.portfolio, type=tx_type, d=when)
            await TransactionLeg.create(
                transaction=tx,
                asset=await Asset.get(id=plan.asset_id),
                qty=plan.qty,
                side=str(plan.type),
            )
        elif plan.type == PlanType.DIV:
            if not (plan.source_asset_id and plan.cash_asset_id and plan.qty):
                raise HTTPException(status_code=400, detail="plan_invalid:div")
            tx = await Transaction.create(
                portfolio=plan.portfolio,
                type=TransactionType.DIV,
                d=when,
                source_asset_id=plan.source_asset_id,
                cash_asset_id=plan.cash_asset_id,
                cash_qty=plan.qty,
            )
        else:
            raise HTTPException(status_code=400, detail="plan_invalid:type")
    await tx.fetch_related("legs__asset", "source_asset", "cash_asset")
    return tx


@router.post("/{plan_id}/execute", response_model=TxRowOut)
async def execute_plan(plan_id: UUID, user: User = Depends(get_current_user)) -> TxRowOut:
    plan = await TransactionPlan.get_or_none(id=plan_id, user=user).prefetch_related("portfolio")
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="plan_not_found")
    tx = await _plan_to_tx(plan)
    await plan.delete()
    return _serialize_tx(tx)


@router.post("/execute-all", response_model=list[TxRowOut])
async def execute_all(user: User = Depends(get_current_user)) -> list[TxRowOut]:
    plans = await TransactionPlan.filter(user=user).prefetch_related("portfolio")
    out = []
    for plan in plans:
        tx = await _plan_to_tx(plan)
        out.append(_serialize_tx(tx))
        await plan.delete()
    return out
