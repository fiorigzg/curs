from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "risk_snapshots" (
    "id" UUID NOT NULL PRIMARY KEY,
    "range" VARCHAR(8) NOT NULL DEFAULT '1Г',
    "vol" DECIMAL(16,8),
    "sharpe" DECIMAL(16,8),
    "sortino" DECIMAL(16,8),
    "ann_ret" DECIMAL(16,8),
    "max_dd" DECIMAL(16,8),
    "cagr" DECIMAL(16,8),
    "calmar" DECIMAL(16,8),
    "beta" DECIMAL(16,8),
    "computed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "portfolio_id" UUID NOT NULL REFERENCES "portfolios" ("id") ON DELETE CASCADE,
    CONSTRAINT "uid_risk_snapsh_portfol_acdfd8" UNIQUE ("portfolio_id", "range")
);
COMMENT ON TABLE "risk_snapshots" IS 'Кэш расчитанных риск-метрик портфеля. Пишется risk_metrics_worker.';"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "risk_snapshots";"""


MODELS_STATE = (
    "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"
)
