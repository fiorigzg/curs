from tortoise import fields
from tortoise.models import Model


class RiskSnapshot(Model):
    """Кэш расчитанных риск-метрик портфеля. Пишется risk_metrics_worker."""

    id = fields.UUIDField(pk=True)
    portfolio = fields.ForeignKeyField(
        "models.Portfolio", related_name="risk_snapshots", on_delete=fields.CASCADE
    )
    range = fields.CharField(max_length=8, default="1Г")  # 1Н|1М|3М|1Г|Всё
    vol = fields.DecimalField(max_digits=16, decimal_places=8, null=True)
    sharpe = fields.DecimalField(max_digits=16, decimal_places=8, null=True)
    sortino = fields.DecimalField(max_digits=16, decimal_places=8, null=True)
    ann_ret = fields.DecimalField(max_digits=16, decimal_places=8, null=True)
    max_dd = fields.DecimalField(max_digits=16, decimal_places=8, null=True)
    cagr = fields.DecimalField(max_digits=16, decimal_places=8, null=True)
    calmar = fields.DecimalField(max_digits=16, decimal_places=8, null=True)
    beta = fields.DecimalField(max_digits=16, decimal_places=8, null=True)
    computed_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "risk_snapshots"
        unique_together = (("portfolio", "range"),)
