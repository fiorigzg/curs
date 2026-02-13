from pydantic import Field
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

    jwt_secret: str = ""
    access_token_ttl_min: int = 15
    refresh_token_ttl_days: int = 30
    fernet_key: str = ""

    cors_origins: str = "*"

    tinkoff_dev_token: str = ""
    tinkoff_sandbox: bool = True
    coingecko_api_key: str = ""
    coingecko_plan: str = "demo"
    cbr_base_url: str = "https://www.cbr.ru"
    # CryptoCompare — многолетняя дневная история крипты (бэкфилл). Ключ опционален
    # (без ключа тоже работает, но ниже rate-limit).
    cryptocompare_api_key: str = ""
    cryptocompare_base_url: str = "https://min-api.cryptocompare.com"

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

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
