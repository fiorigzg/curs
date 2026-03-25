import asyncio
import json
from uuid import UUID

import redis.asyncio as redis_async
import structlog
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status

from curs_api.auth.jwt_tokens import TokenError, decode
from curs_api.settings import settings

router = APIRouter(tags=["websocket"])

log = structlog.get_logger()

QUOTES_CHANNEL = "quotes:updates"


@router.websocket("/ws/quotes")
async def ws_quotes(ws: WebSocket, token: str = Query(default="")) -> None:
    """Live-стрим котировок через Redis pub/sub.

    Воркеры публикуют JSON-сообщения в канал `quotes:updates`.
    Клиент авторизуется access-токеном в query.
    """
    try:
        sub = decode(token, expect_kind="access")
        UUID(sub)
    except (TokenError, ValueError):
        await ws.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await ws.accept()
    log.info("ws.connected", user=sub)

    redis = redis_async.from_url(settings.redis_url, decode_responses=True)
    pubsub = redis.pubsub()
    await pubsub.subscribe(QUOTES_CHANNEL)
    forward_task = asyncio.create_task(_forward(pubsub, ws))

    try:
        while True:
            # Клиент может слать ping или фильтры — пока просто игнорируем.
            await ws.receive_text()
    except WebSocketDisconnect:
        log.info("ws.disconnected", user=sub)
    finally:
        forward_task.cancel()
        try:
            await pubsub.unsubscribe(QUOTES_CHANNEL)
            await pubsub.aclose()
        except Exception:  # noqa: BLE001
            pass
        await redis.aclose()


async def _forward(pubsub, ws: WebSocket) -> None:
    async for msg in pubsub.listen():
        if msg["type"] != "message":
            continue
        try:
            data = json.loads(msg["data"]) if isinstance(msg["data"], str) else msg["data"]
            await ws.send_json(data)
        except Exception:  # noqa: BLE001
            log.warning("ws.forward_fail")
