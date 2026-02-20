from tortoise import fields
from tortoise.models import Model


class AnalyticsLayout(Model):
    """Layout виджетов на экране Аналитики (per-user)."""

    id = fields.UUIDField(pk=True)
    user = fields.OneToOneField(
        "models.User", related_name="analytics_layout", on_delete=fields.CASCADE
    )
    widget_ids = fields.JSONField(default=list)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "analytics_layouts"
