from tortoise import fields
from tortoise.models import Model


class PortfolioMetric(Model):
    """Универсальное хранилище рассчитанных секций аналитики портфеля.

    Одна строка = последний снапшот одной секции (metric_key) портфеля. Запрашивается
    по portfolio_id и по metric_key. ``payload`` — JSON в форме, удобной фронту.

    metric_key ∈ {per_asset, risk, capm, correlation, pairwise, optimization,
    monte_carlo} (см. curs_workers.analytics.SECTIONS).
    """

    id = fields.UUIDField(pk=True)
    portfolio = fields.ForeignKeyField(
        "models.Portfolio", related_name="metrics", on_delete=fields.CASCADE
    )
    metric_key = fields.CharField(max_length=32)
    payload = fields.JSONField()
    computed_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "portfolio_metrics"
        unique_together = (("portfolio", "metric_key"),)
        indexes = (("portfolio_id", "metric_key"),)
