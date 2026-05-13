"""Stage 5 — таблицы риск-аналитики и портфельной оптимизации.

Добавляет:
  asset_prices      — дневная total-return история (adj_close) активов и бенчмарков
  risk_free_rates   — дневной ряд безрисковой ставки по регионам (RU/US)
  portfolio_metrics — универсальное хранилище рассчитанных секций аналитики
  pairwise_metrics  — попарные метрики активов портфеля

Миграция рукописная (как 0_init/1_add_risk_snapshot): окружение разработки без БД,
поэтому MODELS_STATE для aerich-диффинга здесь не сериализуется. `aerich upgrade`
выполняет SQL ниже напрямую и не требует MODELS_STATE.
"""
from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "asset_prices" (
    "id" BIGSERIAL NOT NULL PRIMARY KEY,
    "date" DATE NOT NULL,
    "close" DECIMAL(32,12),
    "adj_close" DECIMAL(32,12) NOT NULL,
    "volume" DECIMAL(32,4),
    "source" VARCHAR(16) NOT NULL,
    "fetched_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "asset_id" VARCHAR(32) REFERENCES "assets" ("id") ON DELETE CASCADE,
    "benchmark_id" VARCHAR(32) REFERENCES "benchmarks" ("id") ON DELETE CASCADE,
    CONSTRAINT "uid_asset_prices_asset_date" UNIQUE ("asset_id", "date"),
    CONSTRAINT "uid_asset_prices_bench_date" UNIQUE ("benchmark_id", "date")
);
CREATE INDEX IF NOT EXISTS "idx_asset_prices_asset_date" ON "asset_prices" ("asset_id", "date");
CREATE INDEX IF NOT EXISTS "idx_asset_prices_bench_date" ON "asset_prices" ("benchmark_id", "date");
COMMENT ON TABLE "asset_prices" IS 'Дневная total-return история (adj_close) активов и бенчмарков.';
CREATE TABLE IF NOT EXISTS "risk_free_rates" (
    "id" BIGSERIAL NOT NULL PRIMARY KEY,
    "date" DATE NOT NULL,
    "region" VARCHAR(4) NOT NULL,
    "rate_annual" DECIMAL(10,6) NOT NULL,
    "source" VARCHAR(16) NOT NULL DEFAULT 'cbr',
    "fetched_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "uid_risk_free_date_region" UNIQUE ("date", "region")
);
CREATE INDEX IF NOT EXISTS "idx_risk_free_region_date" ON "risk_free_rates" ("region", "date");
COMMENT ON COLUMN "risk_free_rates"."region" IS 'RU: RU\nUS: US';
CREATE TABLE IF NOT EXISTS "portfolio_metrics" (
    "id" UUID NOT NULL PRIMARY KEY,
    "metric_key" VARCHAR(32) NOT NULL,
    "payload" JSONB NOT NULL,
    "computed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "portfolio_id" UUID NOT NULL REFERENCES "portfolios" ("id") ON DELETE CASCADE,
    CONSTRAINT "uid_portfolio_metrics_pf_key" UNIQUE ("portfolio_id", "metric_key")
);
CREATE INDEX IF NOT EXISTS "idx_portfolio_metrics_pf_key" ON "portfolio_metrics" ("portfolio_id", "metric_key");
COMMENT ON TABLE "portfolio_metrics" IS 'Универсальное хранилище рассчитанных секций аналитики портфеля.';
CREATE TABLE IF NOT EXISTS "pairwise_metrics" (
    "id" UUID NOT NULL PRIMARY KEY,
    "payload" JSONB NOT NULL,
    "computed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "portfolio_id" UUID NOT NULL REFERENCES "portfolios" ("id") ON DELETE CASCADE,
    "asset_a_id" VARCHAR(32) NOT NULL REFERENCES "assets" ("id") ON DELETE CASCADE,
    "asset_b_id" VARCHAR(32) NOT NULL REFERENCES "assets" ("id") ON DELETE CASCADE,
    CONSTRAINT "uid_pairwise_pf_a_b" UNIQUE ("portfolio_id", "asset_a_id", "asset_b_id")
);
CREATE INDEX IF NOT EXISTS "idx_pairwise_pf" ON "pairwise_metrics" ("portfolio_id");
COMMENT ON TABLE "pairwise_metrics" IS 'Попарные метрики активов портфеля (парная регрессия, 2-активная оптимизация, hedge ratio).';"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "pairwise_metrics";
DROP TABLE IF EXISTS "portfolio_metrics";
DROP TABLE IF EXISTS "risk_free_rates";
DROP TABLE IF EXISTS "asset_prices";"""
