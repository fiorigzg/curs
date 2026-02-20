from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "users" (
    "id" UUID NOT NULL PRIMARY KEY,
    "email" VARCHAR(255) NOT NULL UNIQUE,
    "password_hash" VARCHAR(255) NOT NULL,
    "display_name" VARCHAR(255) NOT NULL,
    "is_active" BOOL NOT NULL DEFAULT True,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "portfolios" (
    "id" UUID NOT NULL PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "color" VARCHAR(9) NOT NULL DEFAULT '#15140F',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" UUID NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "assets" (
    "id" VARCHAR(32) NOT NULL PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "asset_class" VARCHAR(16) NOT NULL,
    "subclass" VARCHAR(32),
    "ccy" VARCHAR(8) NOT NULL DEFAULT 'RUB',
    "icon" VARCHAR(32) NOT NULL DEFAULT 'a-default',
    "tinkoff_figi" VARCHAR(64),
    "coingecko_id" VARCHAR(64),
    "current_price" DECIMAL(24,8),
    "current_price_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "idx_assets_asset_c_3735e1" ON "assets" ("asset_class");
COMMENT ON COLUMN "assets"."asset_class" IS 'TRADFI: tradfi\nCRYPTO: crypto\nFIAT: fiat';
COMMENT ON TABLE "assets" IS 'Каталог активов. id — это тикер (SBER, BTC, OFZ26240, RUB, ...).';
CREATE TABLE IF NOT EXISTS "positions" (
    "id" UUID NOT NULL PRIMARY KEY,
    "qty" DECIMAL(32,12) NOT NULL,
    "avg_price" DECIMAL(32,12) NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "asset_id" VARCHAR(32) NOT NULL REFERENCES "assets" ("id") ON DELETE RESTRICT,
    "portfolio_id" UUID NOT NULL REFERENCES "portfolios" ("id") ON DELETE CASCADE,
    CONSTRAINT "uid_positions_portfol_655bb4" UNIQUE ("portfolio_id", "asset_id")
);
CREATE TABLE IF NOT EXISTS "transactions" (
    "id" UUID NOT NULL PRIMARY KEY,
    "type" VARCHAR(8) NOT NULL,
    "d" TIMESTAMPTZ NOT NULL,
    "cash_qty" DECIMAL(32,12),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cash_asset_id" VARCHAR(32) REFERENCES "assets" ("id") ON DELETE RESTRICT,
    "portfolio_id" UUID NOT NULL REFERENCES "portfolios" ("id") ON DELETE CASCADE,
    "source_asset_id" VARCHAR(32) REFERENCES "assets" ("id") ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS "idx_transaction_portfol_a02b3a" ON "transactions" ("portfolio_id", "d");
COMMENT ON COLUMN "transactions"."type" IS 'IN: in\nOUT: out\nTX: tx\nDIV: div';
CREATE TABLE IF NOT EXISTS "transaction_legs" (
    "id" UUID NOT NULL PRIMARY KEY,
    "qty" DECIMAL(32,12) NOT NULL,
    "side" VARCHAR(4) NOT NULL,
    "asset_id" VARCHAR(32) NOT NULL REFERENCES "assets" ("id") ON DELETE RESTRICT,
    "transaction_id" UUID NOT NULL REFERENCES "transactions" ("id") ON DELETE CASCADE
);
COMMENT ON TABLE "transaction_legs" IS 'Для type=tx — две ноги (out + in). Для in/out — одна нога.';
CREATE TABLE IF NOT EXISTS "transaction_plans" (
    "id" UUID NOT NULL PRIMARY KEY,
    "type" VARCHAR(8) NOT NULL,
    "d" DATE NOT NULL,
    "qty" DECIMAL(32,12),
    "price" DECIMAL(32,12),
    "from_qty" DECIMAL(32,12),
    "to_qty" DECIMAL(32,12),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "asset_id" VARCHAR(32) REFERENCES "assets" ("id") ON DELETE RESTRICT,
    "cash_asset_id" VARCHAR(32) REFERENCES "assets" ("id") ON DELETE RESTRICT,
    "from_asset_id" VARCHAR(32) REFERENCES "assets" ("id") ON DELETE RESTRICT,
    "portfolio_id" UUID NOT NULL REFERENCES "portfolios" ("id") ON DELETE CASCADE,
    "source_asset_id" VARCHAR(32) REFERENCES "assets" ("id") ON DELETE RESTRICT,
    "to_asset_id" VARCHAR(32) REFERENCES "assets" ("id") ON DELETE RESTRICT,
    "user_id" UUID NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_transaction_user_id_2b3763" ON "transaction_plans" ("user_id", "d");
COMMENT ON COLUMN "transaction_plans"."type" IS 'BUY: buy\nSELL: sell\nTX: tx\nIN: in\nOUT: out\nDIV: div';
CREATE TABLE IF NOT EXISTS "benchmarks" (
    "id" VARCHAR(32) NOT NULL PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "source" VARCHAR(16) NOT NULL,
    "ccy" VARCHAR(8) NOT NULL DEFAULT 'RUB',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "quotes" (
    "id" BIGSERIAL NOT NULL PRIMARY KEY,
    "ts" TIMESTAMPTZ NOT NULL,
    "price" DECIMAL(32,12) NOT NULL,
    "source" VARCHAR(16) NOT NULL,
    "asset_id" VARCHAR(32) REFERENCES "assets" ("id") ON DELETE CASCADE,
    "benchmark_id" VARCHAR(32) REFERENCES "benchmarks" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_quotes_asset_i_733888" ON "quotes" ("asset_id", "ts");
CREATE INDEX IF NOT EXISTS "idx_quotes_benchma_29dd15" ON "quotes" ("benchmark_id", "ts");
COMMENT ON TABLE "quotes" IS 'Time-series котировок. Заполняется воркерами (Stage 3) и seed-скриптом.';
CREATE TABLE IF NOT EXISTS "dividends" (
    "id" UUID NOT NULL PRIMARY KEY,
    "ex_date" DATE NOT NULL,
    "pay_date" DATE NOT NULL,
    "amount_per_share" DECIMAL(24,8) NOT NULL,
    "ccy" VARCHAR(8) NOT NULL,
    "asset_id" VARCHAR(32) NOT NULL REFERENCES "assets" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_dividends_asset_i_2645ec" ON "dividends" ("asset_id", "pay_date");
CREATE TABLE IF NOT EXISTS "provider_connections" (
    "id" UUID NOT NULL PRIMARY KEY,
    "provider" VARCHAR(16) NOT NULL,
    "connected" BOOL NOT NULL DEFAULT False,
    "fields_enc" BYTEA,
    "last_tested_at" TIMESTAMPTZ,
    "last_test_ok" BOOL,
    "last_test_latency_ms" INT,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" UUID NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
    CONSTRAINT "uid_provider_co_user_id_5d2eba" UNIQUE ("user_id", "provider")
);
COMMENT ON COLUMN "provider_connections"."provider" IS 'TINKOFF: tinkoff\nCOINGECKO: coingecko';
COMMENT ON TABLE "provider_connections" IS 'Подключение пользователя к внешнему источнику данных.';
CREATE TABLE IF NOT EXISTS "analytics_layouts" (
    "id" UUID NOT NULL PRIMARY KEY,
    "widget_ids" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" UUID NOT NULL UNIQUE REFERENCES "users" ("id") ON DELETE CASCADE
);
COMMENT ON TABLE "analytics_layouts" IS 'Layout виджетов на экране Аналитики (per-user).';
CREATE TABLE IF NOT EXISTS "model_params" (
    "id" UUID NOT NULL PRIMARY KEY,
    "benchmark_ru" VARCHAR(32) NOT NULL DEFAULT 'IMOEX',
    "benchmark_us" VARCHAR(32) NOT NULL DEFAULT 'SP500',
    "benchmark_crypto" VARCHAR(32) NOT NULL DEFAULT 'BTC',
    "beta_window_days" INT NOT NULL DEFAULT 90,
    "risk_free_rub" DECIMAL(10,6) NOT NULL DEFAULT 0.1600000000000000033306690738754696212708950042724609375,
    "risk_free_usd" DECIMAL(10,6) NOT NULL DEFAULT 0.04499999999999999833466546306226518936455249786376953125,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" UUID NOT NULL UNIQUE REFERENCES "users" ("id") ON DELETE CASCADE
);
COMMENT ON TABLE "model_params" IS 'Параметры финансовых моделей per-user. Используется Stage 5 расчётами.';
CREATE TABLE IF NOT EXISTS "aerich" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "version" VARCHAR(255) NOT NULL,
    "app" VARCHAR(100) NOT NULL,
    "content" JSONB NOT NULL
);"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        """


MODELS_STATE = (
    "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"
)
