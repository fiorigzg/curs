from fastapi import APIRouter, Depends

from curs_api.deps import get_current_user
from curs_api.models import AnalyticsLayout, User
from curs_api.schemas.layout import LayoutBody

DEFAULT_LAYOUT = ["kpi-value", "kpi-pl", "kpi-sharpe", "kpi-maxdd", "equity", "structure", "classes", "drawdown"]

router = APIRouter(prefix="/users/me/analytics-layout", tags=["analytics-layout"])


@router.get("", response_model=LayoutBody)
async def get_layout(user: User = Depends(get_current_user)) -> LayoutBody:
    layout = await AnalyticsLayout.get_or_none(user=user)
    if not layout:
        layout = await AnalyticsLayout.create(user=user, widget_ids=DEFAULT_LAYOUT)
    return LayoutBody(widget_ids=layout.widget_ids)


@router.put("", response_model=LayoutBody)
async def put_layout(body: LayoutBody, user: User = Depends(get_current_user)) -> LayoutBody:
    layout, _ = await AnalyticsLayout.get_or_create(user=user)
    layout.widget_ids = body.widget_ids
    await layout.save()
    return LayoutBody(widget_ids=layout.widget_ids)
