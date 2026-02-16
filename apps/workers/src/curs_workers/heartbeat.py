import asyncio
import os
from pathlib import Path

HEARTBEAT_PATH = Path("/tmp/curs-worker.heartbeat")  # noqa: S108


async def heartbeat_loop(interval_sec: int = 5) -> None:
    """Touch heartbeat file periodically; healthcheck checks its mtime."""
    while True:
        HEARTBEAT_PATH.touch(exist_ok=True)
        os.utime(HEARTBEAT_PATH, None)
        await asyncio.sleep(interval_sec)
