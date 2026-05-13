from tortoise import fields
from tortoise.models import Model


class PairwiseMetric(Model):
    """Попарные метрики активов портфеля (парная регрессия, 2-активная оптимизация,
    hedge ratio). Одна строка на упорядоченную пару (asset_a_id < asset_b_id), чтобы
    не хранить (A,B) и (B,A) одновременно.

    ``payload`` — JSON: {alpha, betaB, betaM, r2, residStd, pValues, minVar, maxSharpe,
    hedge, ...} (см. curs_workers.analytics.compute_pairwise).
    """

    id = fields.UUIDField(pk=True)
    portfolio = fields.ForeignKeyField(
        "models.Portfolio", related_name="pairwise_metrics", on_delete=fields.CASCADE
    )
    # asset_a/asset_b — строковые тикеры (Asset.id). Храним как FK к assets.
    asset_a = fields.ForeignKeyField(
        "models.Asset", related_name="pairwise_as_a", on_delete=fields.CASCADE
    )
    asset_b = fields.ForeignKeyField(
        "models.Asset", related_name="pairwise_as_b", on_delete=fields.CASCADE
    )
    payload = fields.JSONField()
    computed_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "pairwise_metrics"
        unique_together = (("portfolio", "asset_a", "asset_b"),)
        indexes = (("portfolio_id",),)
