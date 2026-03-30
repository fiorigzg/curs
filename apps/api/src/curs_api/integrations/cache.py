"""Redis-утилиты для интеграций: TTL-кэш котировок и token-bucket rate-limit.

Один общий async-клиент на процесс. Token bucket — для CoinGecko Demo (30 req/min):
храним счётчик в ключе с окном-секундой, sleep до следующего окна при переполнении.
"""
from __future__ import annotations

import asyncio
import json
import time
from typing import Any

import redis.asyncio as redis_async
import structlog

from curs_api.settings import settings

log = structlog.get_logger()

_redis: redis_async.Redis | None = None


def get_redis() -> redis_async.Redis:
    global _redis
    if _redis is None:
        _redis = redis_async.from_url(settings.redis_url, decode_responses=True)
    return _redis


async def cache_get_json(key: str) -> Any | None:
    raw = await get_redis().get(key)
    return json.loads(raw) if raw else None


async def cache_set_json(key: str, value: Any, ttl_sec: int) -> None:
    await get_redis().set(key, json.dumps(value), ex=ttl_sec)


async def publish(channel: str, payload: dict) -> None:
    await get_redis().publish(channel, json.dumps(payload))


class RateLimiter:
    """Sliding-window token bucket в Redis. Безопасен для нескольких воркеров.

    Реализация: фиксированное окно в `window_sec` секунд, INCR на каждый запрос,
    EXPIRE на окно. При превышении лимита — sleep до конца окна.
    """

    def __init__(self, name: str, max_calls: int, window_sec: int = 60) -> None:
        self.name = name
        self.max_calls = max_calls
        self.window_sec = window_sec

    async def acquire(self) -> None:
        r = get_redis()
        while True:
            now = int(time.time())
            window = now // self.window_sec
            key = f"ratelimit:{self.name}:{window}"
            count = await r.incr(key)
            if count == 1:
                await r.expire(key, self.window_sec + 1)
            if count <= self.max_calls:
                return
            # окно переполнено — ждём до следующего
            sleep_for = self.window_sec - (now % self.window_sec)
            log.debug("ratelimit.wait", name=self.name, sleep=sleep_for)
            await asyncio.sleep(sleep_for)
