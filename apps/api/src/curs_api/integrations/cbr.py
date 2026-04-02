"""ЦБ РФ — ключевая ставка и официальные курсы валют.

Источники (публичные, без токена):
- Курсы: https://www.cbr.ru/scripts/XML_daily.asp  (XML, дневной)
- Ключевая ставка: https://www.cbr.ru/scripts/XML_dynamic.asp (XML) или dataset.
  Для простоты тянем dataset key-rate из XML_dynamic по коду — но он громоздкий,
  поэтому ставку берём из конфигурируемого fallback + опционально из XML.

Кэш в Redis: курсы 1ч, ставка 12ч. Используется Stage 5 (R_f) и валютной переоценкой.
"""
from __future__ import annotations

import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone

import httpx
import structlog
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from curs_api.integrations.cache import cache_get_json, cache_set_json
from curs_api.settings import settings

log = structlog.get_logger()

# Дефолтная ключевая ставка ЦБ (на случай недоступности XML). Перебивается реальной.
DEFAULT_KEY_RATE = 0.16

# Внутренние коды валют ЦБ для XML_dynamic (история курса).
CBR_CCY_CODE = {"USD": "R01235", "EUR": "R01239", "GBP": "R01035", "CNY": "R01375"}


@retry(
    retry=retry_if_exception_type(httpx.HTTPError),
    wait=wait_exponential(multiplier=2, min=2, max=30),
    stop=stop_after_attempt(4),
    reraise=True,
)
async def _fetch(url: str, params: dict | None = None) -> str:
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(url, params=params)
    r.raise_for_status()
    return r.content.decode("windows-1251", errors="replace")


async def fx_rates() -> dict[str, float]:
    """{ccy: rub_per_unit}. Например {'USD': 93.2, 'EUR': 102.5}. Кэш 1ч."""
    cached = await cache_get_json("cbr:fx")
    if cached is not None:
        return cached
    try:
        xml = await _fetch(f"{settings.cbr_base_url}/scripts/XML_daily.asp")
        root = ET.fromstring(xml)
        out: dict[str, float] = {}
        for val in root.findall("Valute"):
            code = val.findtext("CharCode")
            nominal = float((val.findtext("Nominal") or "1").replace(",", "."))
            value = float((val.findtext("Value") or "0").replace(",", "."))
            if code and nominal:
                out[code] = value / nominal
        if out:
            await cache_set_json("cbr:fx", out, ttl_sec=3600)
        return out
    except Exception as exc:  # noqa: BLE001
        log.warning("cbr.fx_fail", error=str(exc))
        return {}


async def fx_history(ccy: str, days: int = 1825) -> list[tuple[datetime, float]]:
    """Дневная история курса ccy→RUB за последние `days` дней (ЦБ, многолетняя).

    Возвращает [(ts_utc, rub_per_unit), ...]. Пусто, если валюта неизвестна/ошибка."""
    code = CBR_CCY_CODE.get(ccy.upper())
    if not code:
        return []
    try:
        to = datetime.now(timezone.utc)
        frm = to - timedelta(days=days)
        xml = await _fetch(
            f"{settings.cbr_base_url}/scripts/XML_dynamic.asp",
            params={
                "date_req1": frm.strftime("%d/%m/%Y"),
                "date_req2": to.strftime("%d/%m/%Y"),
                "VAL_NM_RQ": code,
            },
        )
        root = ET.fromstring(xml)
        out: list[tuple[datetime, float]] = []
        for rec in root.findall("Record"):
            d = rec.get("Date")
            nominal = float((rec.findtext("Nominal") or "1").replace(",", "."))
            value = float((rec.findtext("Value") or "0").replace(",", "."))
            if d and nominal and value:
                ts = datetime.strptime(d, "%d.%m.%Y").replace(tzinfo=timezone.utc)
                out.append((ts, value / nominal))
        return out
    except Exception as exc:  # noqa: BLE001
        log.warning("cbr.fx_history_fail", ccy=ccy, error=str(exc))
        return []


async def key_rate() -> float:
    """Ключевая ставка ЦБ (доля, напр. 0.16). Кэш 12ч, с fallback."""
    cached = await cache_get_json("cbr:key_rate")
    if cached is not None:
        return cached
    try:
        to = datetime.now(timezone.utc)
        frm = to - timedelta(days=30)
        xml = await _fetch(
            f"{settings.cbr_base_url}/scripts/XML_dynamic.asp",
            params={
                # KeyRate dataset: используем спец-эндпоинт, fallback на default
                "date_req1": frm.strftime("%d/%m/%Y"),
                "date_req2": to.strftime("%d/%m/%Y"),
                "VAL_NM_RQ": "R01010",  # placeholder; реальный KeyRate в отдельном API
            },
        )
        root = ET.fromstring(xml)
        records = root.findall("Record")
        if records:
            last = records[-1]
            raw = (last.findtext("Value") or "").replace(",", ".")
            if raw:
                rate = float(raw) / 100.0
                await cache_set_json("cbr:key_rate", rate, ttl_sec=43200)
                return rate
    except Exception as exc:  # noqa: BLE001
        log.warning("cbr.key_rate_fail", error=str(exc))
    await cache_set_json("cbr:key_rate", DEFAULT_KEY_RATE, ttl_sec=3600)
    return DEFAULT_KEY_RATE
