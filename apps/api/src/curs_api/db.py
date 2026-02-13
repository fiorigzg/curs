from curs_api.settings import settings

MODELS = [
    "curs_api.models.user",
    "curs_api.models.portfolio",
    "curs_api.models.asset",
    "curs_api.models.position",
    "curs_api.models.transaction",
    "curs_api.models.plan",
    "curs_api.models.quote",
    "curs_api.models.risk_snapshot",
    "curs_api.models.benchmark",
    "curs_api.models.dividend",
    "curs_api.models.provider",
    "curs_api.models.layout",
    "curs_api.models.model_params",
    "curs_api.models.asset_price",
    "curs_api.models.risk_free_rate",
    "curs_api.models.portfolio_metric",
    "curs_api.models.pairwise_metric",
    "aerich.models",
]

TORTOISE_ORM = {
    "connections": {"default": settings.postgres_dsn},
    "apps": {
        "models": {
            "models": MODELS,
            "default_connection": "default",
        }
    },
    "use_tz": True,
    "timezone": "UTC",
}
