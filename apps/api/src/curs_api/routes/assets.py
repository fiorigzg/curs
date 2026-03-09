import asyncio
from datetime import date as date_cls
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from tortoise.expressions import Q

from curs_api.deps import get_current_user
from curs_api.integrations import coingecko, tinkoff
from curs_api.models import Asset, AssetClass, Quote, Transaction, User
from curs_api.schemas.asset import AssetImport, AssetOut, AssetQuote, AssetSearchOut
from curs_api.services.valuation import rub_price_at

router = APIRouter(prefix="/assets", tags=["assets"])


@router.get("", response_model=list[AssetOut])
async def list_assets(
    cls: str | None = Query(default=None, alias="class"),
    _: User = Depends(get_current_user),
) -> list[AssetOut]:
    qs = Asset.all().order_by("name")
    if cls and cls != "all":
        qs = qs.filter(asset_class=cls)
    return [AssetOut.from_model(a) for a in await qs]


# ──────────────────────────── Поиск ────────────────────────────
async def _recent_asset_ids(user: User, *, tx_limit: int = 60) -> list[str]:
    """ID активов из последних сделок пользователя (по убыванию давности, без дублей)."""
    rows = (
        await Transaction.filter(portfolio__user=user)
        .order_by("-d", "-created_at")
        .limit(tx_limit)
        .prefetch_related("legs", "source_asset", "cash_asset")
    )
    ids: list[str] = []
    for t in rows:
        for leg in t.legs:
            if leg.asset_id:
                ids.append(leg.asset_id)
        if t.source_asset_id:
            ids.append(t.source_asset_id)
        if t.cash_asset_id:
            ids.append(t.cash_asset_id)
    seen: set[str] = set()
    out: list[str] = []
    for i in ids:
        if i not in seen:
            seen.add(i)
            out.append(i)
    return out


def _local_item(a: Asset) -> AssetSearchOut:
    return AssetSearchOut(
        id=a.id,
        name=a.name,
        asset_class=str(a.asset_class),
        subclass=a.subclass,
        sub=a.subclass,
        ccy=a.ccy,
        icon=a.icon,
        price=float(a.current_price) if a.current_price is not None else None,
        importable=False,
        source=None,
    )


async def _external_search(q: str) -> list[dict]:
    """Кандидаты из внешних API (T-Invest + CoinGecko). Best-effort, с жёстким таймаутом."""
    try:
        results = await asyncio.wait_for(
            asyncio.gather(
                tinkoff.find_instruments(q),
                coingecko.search_coins(q),
                return_exceptions=True,
            ),
            timeout=4.0,
        )
    except Exception:  # noqa: BLE001
        return []
    out: list[dict] = []
    for r in results:
        if isinstance(r, list):
            out.extend(r)
    return out


@router.get("/search", response_model=list[AssetSearchOut])
async def search_assets(
    q: str = Query(default="", max_length=64),
    limit: int = Query(default=20, ge=1, le=50),
    ext: bool = Query(default=True),
    user: User = Depends(get_current_user),
) -> list[AssetSearchOut]:
    q_norm = q.strip()
    recent_ids = await _recent_asset_ids(user)

    if q_norm:
        local = (
            await Asset.filter(Q(id__icontains=q_norm) | Q(name__icontains=q_norm))
            .order_by("name")
            .limit(limit * 3)
        )
    else:
        local = await Asset.all().order_by("name").limit(limit * 3)

    by_id: dict[str, Asset] = {a.id: a for a in local}
    # Недавние активы могли не попасть в выборку — дотягиваем их объекты.
    missing = [rid for rid in recent_ids if rid not in by_id]
    if missing:
        for a in await Asset.filter(id__in=missing):
            by_id[a.id] = a

    ql = q_norm.lower()

    def matches(a: Asset) -> bool:
        return not q_norm or ql in a.id.lower() or ql in a.name.lower()

    ordered: list[Asset] = []
    used: set[str] = set()
    for rid in recent_ids:  # недавние — первыми
        a = by_id.get(rid)
        if a and rid not in used and matches(a):
            ordered.append(a)
            used.add(rid)
    for a in local:  # затем остальные локальные (уже по name)
        if a.id not in used:
            ordered.append(a)
            used.add(a.id)

    items = [_local_item(a) for a in ordered[:limit]]

    # Внешний поиск — только если локальных мало (чтобы частые запросы были мгновенными).
    if ext and len(q_norm) >= 2 and len(items) < 8:
        for c in await _external_search(q_norm):
            cid = c["id"]
            if cid in used:
                continue
            items.append(
                AssetSearchOut(
                    id=cid,
                    name=c["name"],
                    asset_class=c["class"],
                    subclass=c.get("subclass"),
                    sub=c.get("subclass"),
                    ccy=c.get("ccy", "RUB"),
                    icon="a-default",
                    price=None,
                    importable=True,
                    source=c.get("source"),
                )
            )
            used.add(cid)
            if len(items) >= limit:
                break

    return items


@router.post("/import", response_model=AssetOut, status_code=status.HTTP_201_CREATED)
async def import_asset(body: AssetImport, _: User = Depends(get_current_user)) -> AssetOut:
    """Материализует выбранный внешний инструмент в каталог. Идемпотентно."""
    aid = body.id.upper()
    existing = await Asset.get_or_none(id=aid)
    if existing:
        return AssetOut.from_model(existing)

    figi = body.figi
    coingecko_id = body.coingecko_id
    price: float | None = None
    try:
        if body.source == "tinkoff":
            if not figi:
                figi = await asyncio.wait_for(tinkoff.resolve_figi(aid), timeout=5.0)
            if figi:
                prices = await asyncio.wait_for(tinkoff.last_prices([figi]), timeout=5.0)
                price = prices.get(figi)
        elif body.source == "coingecko" and coingecko_id:
            pr = await asyncio.wait_for(coingecko.simple_prices([coingecko_id]), timeout=5.0)
            price = pr.get(coingecko_id)
    except Exception:  # noqa: BLE001
        price = None

    a = await Asset.create(
        id=aid,
        name=body.name,
        asset_class=AssetClass(body.asset_class),
        subclass=body.subclass,
        ccy=body.ccy,
        icon="a-default",
        tinkoff_figi=figi,
        coingecko_id=coingecko_id,
        current_price=price,
        current_price_at=datetime.now(timezone.utc) if price is not None else None,
    )
    return AssetOut.from_model(a)


@router.get("/convert")
async def convert(
    from_: str = Query(alias="from"),
    to: str = Query(...),
    qty: float = Query(..., gt=0),
    at: date_cls = Query(...),
    _: User = Depends(get_current_user),
) -> dict:
    """Сколько `to` получится за `qty` единиц `from` по курсу на дату `at`.

    Считается через рублёвую стоимость на ту же дату (как в торговой таблице:
    AmountC2 = AmountC1 × PriceC1 / PriceC2), поэтому ловит и движение валюты."""
    a_from = await Asset.get_or_none(id=from_.upper())
    a_to = await Asset.get_or_none(id=to.upper())
    if not a_from or not a_to:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="asset_not_found")
    when = datetime.combine(at, datetime.min.time(), tzinfo=timezone.utc)
    rub_from = await rub_price_at(a_from, when)
    rub_to = await rub_price_at(a_to, when)
    if rub_from <= 0 or rub_to <= 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="no_price_at_date"
        )
    qty_dec = Decimal(str(qty))
    to_qty = qty_dec * rub_from / rub_to
    return {
        "fromAsset": a_from.id,
        "toAsset": a_to.id,
        "fromQty": qty,
        "toQty": float(to_qty),
        "fromValueRub": float(qty_dec * rub_from),
        "rubFrom": float(rub_from),
        "rubTo": float(rub_to),
        "at": at.isoformat(),
    }


@router.get("/{asset_id}", response_model=AssetOut)
async def get_asset(asset_id: str, _: User = Depends(get_current_user)) -> AssetOut:
    a = await Asset.get_or_none(id=asset_id.upper())
    if not a:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="asset_not_found")
    return AssetOut.from_model(a)


@router.get("/{asset_id}/quote", response_model=AssetQuote)
async def get_quote(asset_id: str, _: User = Depends(get_current_user)) -> AssetQuote:
    a = await Asset.get_or_none(id=asset_id.upper())
    if not a:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="asset_not_found")
    return AssetQuote(
        asset_id=a.id,
        price=float(a.current_price) if a.current_price is not None else None,
        ccy=a.ccy,
        ts=a.current_price_at.isoformat() if a.current_price_at else None,
    )


@router.get("/{asset_id}/series")
async def get_series(
    asset_id: str,
    days: int = Query(default=365, ge=1, le=3650),
    _: User = Depends(get_current_user),
) -> list[dict]:
    a = await Asset.get_or_none(id=asset_id.upper())
    if not a:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="asset_not_found")
    since = datetime.now(timezone.utc) - timedelta(days=days)
    rows = (
        await Quote.filter(asset=a, ts__gte=since).order_by("ts").values("ts", "price")
    )
    return [{"d": r["ts"].isoformat(), "v": float(r["price"])} for r in rows]
