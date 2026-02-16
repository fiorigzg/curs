from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=None, extra="ignore")

    postgres_host: str = "postgres"
    postgres_port: int = 5432
    postgres_db: str = "curs"
    postgres_user: str = "curs"
    postgres_password: str = ""

    redis_host: str = "redis"
    redis_port: int = 6379
    redis_password: str = ""

    tinkoff_dev_token: str = ""
    tinkoff_sandbox: bool = True
    coingecko_api_key: str = ""
    coingecko_plan: str = "demo"

    quotes_poll_interval_sec: int = 12
    risk_metrics_poll_interval_sec: int = 300
    # Ежедневная синхронизация total-return истории (asset_prices) + risk-free.
    price_history_poll_interval_sec: int = 86400

    log_level: str = "INFO"
    log_format: str = "console"

    @property
    def postgres_dsn(self) -> str:
        return (
            f"postgres://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def redis_url(self) -> str:
        auth = f":{self.redis_password}@" if self.redis_password else ""
        return f"redis://{auth}{self.redis_host}:{self.redis_port}/0"


settings = Settings()
