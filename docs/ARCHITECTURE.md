# CURS — Architecture

Высокоуровневая архитектура, ER-диаграмма и API-контракт под экраны `SCREENS_MAP.md`.

> **Стек жёстко зафиксирован `AGENT_PROMPT.md`**: pnpm monorepo, Docker compose, Traefik (с условным `DOMAIN`), Postgres 16, Redis, FastAPI + Tortoise ORM + Aerich + Pydantic v2, async workers, RN+Expo + FSD + TanStack Query + Zustand + Skia.

---

## 1. Топология сервисов

```
                ┌─────────┐
                │ Traefik │  (если DOMAIN= → Let's Encrypt; иначе порты на localhost)
                └────┬────┘
       ┌─────────────┼──────────────┬──────────────────┐
       │             │              │                  │
   ┌───▼───┐   ┌────▼────┐    ┌─────▼─────┐     ┌──────▼──────┐
   │ web/  │   │  api    │    │  workers  │     │ workers/    │
   │ mobile│   │ FastAPI │    │ quotes_   │     │ risk_       │
   │ (Expo)│   │  +uvic. │    │ worker    │     │ metrics_w   │
   └───┬───┘   └───┬─────┘    └─────┬─────┘     └──────┬──────┘
       │           │                │                  │
       │       ┌───▼────┐       ┌───▼────┐       ┌─────▼──────┐
       │       │Postgres│       │ Redis  │       │ ext. APIs  │
       │       │  16    │       │ pub/sub│       │ MOEX ISS / │
       │       └────────┘       │ +cache │       │ CoinGecko  │
       │                        └────────┘       └────────────┘
       └───────────── WebSocket /ws/quotes (через api) ────────┘
```

- **api** — REST + WebSocket для UI.
- **workers** — отдельные процессы; каждый раз в N секунд тянет данные, кладёт в Postgres, публикует delta в Redis pub/sub.
- **api** подписан на Redis pub/sub → стримит обновления в `/ws/quotes` всем подключённым клиентам.
- **Traefik labels** на api/web включаются условно — если `DOMAIN` пуст, контейнеры биндят порты `8000`/`3000` на localhost (или используется compose override).

### Composition воркеров

- `quotes_worker` — поллинг текущих цен из MOEX (для tradfi) и CoinGecko (для crypto). Учитывает rate limits (CoinGecko Demo: 30 req/min; MOEX ISS: без жёсткого лимита, но respect 1 req/s).
- `portfolio_sync_worker` — пересчёт стоимости позиций при изменении цен (debounce per portfolio).
- `risk_metrics_worker` — пересчёт метрик (vol, sharpe, beta, maxDD) на дневной частоте или по запросу.

---

## 2. ER-диаграмма

```mermaid
erDiagram
    USER ||--o{ PORTFOLIO : owns
    USER ||--o{ PROVIDER_CONNECTION : configures
    USER ||--o{ ANALYTICS_LAYOUT : has
    USER ||--o{ TRANSACTION_PLAN : drafts

    PORTFOLIO ||--o{ POSITION : contains
    PORTFOLIO ||--o{ TRANSACTION : records
    PORTFOLIO ||--o{ RISK_SNAPSHOT : computes

    ASSET ||--o{ POSITION : referenced_by
    ASSET ||--o{ QUOTE : has_prices
    ASSET ||--o{ TRANSACTION_LEG : involves
    ASSET ||--o{ DIVIDEND : pays_out

    TRANSACTION ||--o{ TRANSACTION_LEG : has_legs
    TRANSACTION_PLAN ||--o{ TRANSACTION_LEG : projects

    BENCHMARK ||--o{ QUOTE : has_prices

    MODEL_PARAMS ||--|| USER : configured_by

    USER {
        uuid id PK
        string email UQ
        string password_hash
        string display_name
        timestamp created_at
        timestamp updated_at
    }

    PORTFOLIO {
        uuid id PK
        uuid user_id FK
        string name
        string color
        timestamp created_at
    }

    ASSET {
        string id PK "SBER, BTC, OFZ26240, RUB..."
        string name
        string class "tradfi|crypto|fiat"
        string subclass "Акция|Облигация|ETF|Фонд|null"
        string ccy "RUB|USD|EUR|..."
        string icon "a-sber, a-btc, a-default..."
        string moex_secid "null if not tradfi"
        string coingecko_id "null if not crypto"
        timestamp created_at
    }

    POSITION {
        uuid id PK
        uuid portfolio_id FK
        string asset_id FK
        decimal qty
        decimal avg_price "in trading ccy"
        timestamp updated_at
    }

    TRANSACTION {
        uuid id PK
        uuid portfolio_id FK
        string type "in|out|tx|div"
        timestamp d
        string source_asset_id "for div"
        string cash_asset_id "for div"
        decimal cash_qty "for in|out|div"
        timestamp created_at
    }

    TRANSACTION_LEG {
        uuid id PK
        uuid transaction_id FK "or transaction_plan_id"
        uuid transaction_plan_id FK "or transaction_id"
        string asset_id FK
        decimal qty
        string side "out|in (relative to portfolio)"
    }

    TRANSACTION_PLAN {
        uuid id PK
        uuid user_id FK
        uuid portfolio_id FK
        string type "buy|sell|tx|in|out|div"
        date d "planned date"
        decimal price "for buy|sell, in asset's ccy"
        string cash_asset_id "for buy|sell|div"
        string source_asset_id "for div"
        decimal cash_qty "for in|out|div"
        timestamp created_at
    }

    QUOTE {
        bigserial id PK
        string asset_id FK "or benchmark_id"
        string benchmark_id FK
        timestamp ts
        decimal price
        string source "moex|coingecko|cbr"
    }

    DIVIDEND {
        uuid id PK
        string asset_id FK
        date ex_date
        date pay_date
        decimal amount_per_share
        string ccy
    }

    BENCHMARK {
        string id PK "IMOEX, SP500, BTC_INDEX, ..."
        string name
        string source "moex|coingecko|manual"
        string ccy
    }

    RISK_SNAPSHOT {
        uuid id PK
        uuid portfolio_id FK
        string range "1Н|1М|3М|1Г|Всё"
        decimal vol
        decimal sharpe
        decimal sortino
        decimal ann_ret
        decimal max_dd
        decimal cagr
        decimal calmar
        decimal beta "vs main benchmark"
        timestamp computed_at
    }

    MODEL_PARAMS {
        uuid id PK
        uuid user_id FK
        string benchmark_ru "default IMOEX"
        string benchmark_us "default SP500"
        string benchmark_crypto "default TOTAL_MCAP or BTC"
        integer beta_window_days "default 90"
        decimal risk_free_rub "from CBR key rate"
        decimal risk_free_usd "from UST10Y"
        timestamp updated_at
    }

    PROVIDER_CONNECTION {
        uuid id PK
        uuid user_id FK
        string provider "moex|coingecko"
        boolean connected
        bytes fields_enc "Fernet-encrypted JSON"
        timestamp updated_at
    }

    ANALYTICS_LAYOUT {
        uuid id PK
        uuid user_id FK
        string[] widget_ids "ordered"
        timestamp updated_at
    }
```

### Замечания по модели

- **TRANSACTION + TRANSACTION_LEG** — двухуровневая модель чтобы единообразно описать все 4 типа (in/out/tx/div) и оба «направления» в swap. Альтернатива — полиморфная таблица с nullable полями — даёт более компактные запросы и используется в дизайне; решает пользователь.
- **TRANSACTION_PLAN** — отделён от TRANSACTION (планы локальные в дизайне, через localStorage). Можно либо хранить серверно (мульти-устройство), либо оставить локально (как в прототипе). Это бизнес-выбор.
- **ASSET.id строка** — соответствует дизайну (тикер как ключ). Альтернатива — uuid + uniq на (class, exchange_id) — даст гибкость, но усложнит роуты. По умолчанию идём за дизайном.
- **QUOTE** — append-only time-series. Для prod-нагрузки имеет смысл партиционирование по месяцам или TimescaleDB. На MVP — обычная таблица + индексы.
- **RISK_SNAPSHOT** — кэш расчётов с TTL. По умолчанию пересчитывается воркером раз в день.
- **MODEL_PARAMS** — параметры финансовых моделей (см. Stage 5 в `FINANCE_MODELS.md`). На пользователя один ряд.
- **DIVIDEND** — справочник дивидендных выплат активов. Заполняется опционально (через MOEX dividends API или вручную).

---

## 3. API контракт (OpenAPI-first, строго под экраны)

База: `/api/v1`. JSON. JWT в `Authorization: Bearer <token>` (кроме `/auth/*`). WebSocket: `/ws/quotes`.

### 3.1 Auth

| Method | Path | Body | Returns | Используется |
|---|---|---|---|---|
| POST | `/auth/register` | `{email, password, displayName}` | `{user, accessToken, refreshToken}` | (нет UI в дизайне — но нужен для onboarding) |
| POST | `/auth/login` | `{email, password}` | `{user, accessToken, refreshToken}` | (нет UI в дизайне — нужен) |
| POST | `/auth/refresh` | `{refreshToken}` | `{accessToken, refreshToken}` | invisible |
| POST | `/auth/logout` | — | 204 | user-card menu (задел) |
| POST | `/auth/password` | `{current, new}` | 200 \| 401 | Settings → SecurityCard |

⚠️ Login/Register UI в дизайне отсутствует. Спросить у пользователя — пишем тонкий экран в стилистике дизайна или временно используем seed-юзера?

### 3.2 Dashboard / Overview

| Method | Path | Returns | Экран |
|---|---|---|---|
| GET | `/dashboard/overview` | `{total, totalCost, totalPl, totalPlPct, yearPct, series: [{d, v}], byClass: {tradfi, crypto, fiat}}` | Обзор: hero + class-strip |

### 3.3 Portfolios

| Method | Path | Returns / Body | Экран |
|---|---|---|---|
| GET | `/portfolios` | `[{id, name, color, positionsCount, total, deltaPct90d, series90d}]` | Обзор · Sidebar |
| POST | `/portfolios` | `{name, color}` → portfolio | Sidebar «+» (TODO в дизайне) |
| GET | `/portfolios/{id}` | `{...portfolio, total, totalCost, pl, plPct, deltaPct3M, series3M, positions: [...]}` | Portfolio screen |
| PUT | `/portfolios/{id}` | `{name?, color?}` | (нет UI в дизайне) |
| DELETE | `/portfolios/{id}` | 204 | (нет UI в дизайне) |
| GET | `/portfolios/{id}/positions?class=...&sort=...&dir=...` | `Position[]` (с derived: valBase, costBase, pl, plPct, dayPct, share) | Portfolio screen |
| GET | `/portfolios/{id}/transactions?limit=N` | `Transaction[]` | Portfolio screen |

### 3.4 Assets

| Method | Path | Returns / Body | Экран |
|---|---|---|---|
| GET | `/assets` | `Asset[]` (полный каталог) | AddTxModal, AddAssetModal selects |
| POST | `/assets` | `{id, name, class, sub?, ccy, icon, price?}` | AddAssetModal submit |
| GET | `/assets/{id}` | `Asset` (с series) | (для будущего position detail) |
| GET | `/assets/{id}/quote` | `{price, ts, ccy}` | live polling fallback |
| GET | `/assets/{id}/series?days=N` | `[{d, v}]` | analytics widgets |

### 3.5 Transactions

| Method | Path | Returns / Body | Экран |
|---|---|---|---|
| GET | `/transactions?limit=N&offset=M&portfolio=id` | `Transaction[]` | Dashboard recent + Portfolio txs |
| POST | `/transactions` | `Transaction` body (полиморфный) | AddTxModal submit, executePlan |
| POST | `/transactions/batch` | `Transaction[]` | executeAll plans |
| DELETE | `/transactions/{id}` | 204 | (нет UI в дизайне) |

### 3.6 Analytics — метрики и виджеты

| Method | Path | Returns | Виджет |
|---|---|---|---|
| GET | `/portfolios/{id}/metrics?range=...` | `{vol, sharpe, sortino, annRet, maxDD, cagr, calmar}` | kpi-* виджеты |
| GET | `/portfolios/{id}/series?range=...` | `[{d, v}]` | equity, drawdown |
| GET | `/portfolios/{id}/structure` | `[{assetId, label, value, share, color}]` (top 12) | structure (treemap) |
| GET | `/portfolios/{id}/by-class` | `[{class, value, share}]` | classes (donut) |
| GET | `/portfolios/{id}/drawdown?range=...` | `{series: [{d, dd}], maxDd, maxDdDate}` | drawdown |
| GET | `/portfolios/{id}/correlation` | `{labels, matrix}` | correlation, corr-pairs |
| GET | `/portfolios/{id}/frontier` | `{cloud, frontier, current, optimal, minvar}` | frontier widget |
| POST | `/portfolios/{id}/montecarlo` | body `{horizon, simulations}` → `{paths, percentiles, startValue, target}` | montecarlo widget |
| GET | `/portfolios/{id}/monthly-returns` | `[{y, m, ret}]` | monthly widget |
| GET | `/benchmarks/{id}/series?range=...` | `[{d, v}]` | equity (overlay) |

### 3.7 Analytics layout

| Method | Path | Returns / Body | Экран |
|---|---|---|---|
| GET | `/users/me/analytics-layout` | `{widgetIds: []}` | Analytics initial load |
| PUT | `/users/me/analytics-layout` | `{widgetIds: []}` | сохраняется при move/add/remove |

(Можно оставить только в localStorage — но при мульти-устройстве хорошо иметь серверный sync. Откладываем решение на §Open Questions.)

### 3.8 Transaction plans (Планировщик)

| Method | Path | Returns / Body | Экран |
|---|---|---|---|
| GET | `/users/me/plans` | `Plan[]` | Calc screen |
| POST | `/users/me/plans` | `PlanDraft` → `Plan` | add |
| PUT | `/users/me/plans/{id}` | `PlanDraft` → `Plan` | edit |
| DELETE | `/users/me/plans/{id}` | 204 | delete |
| DELETE | `/users/me/plans` | 204 | clearAll |
| POST | `/users/me/plans/{id}/execute` | — → `Transaction` | executePlan |
| POST | `/users/me/plans/execute-all` | — → `Transaction[]` | executeAll |

### 3.9 Providers (Settings)

| Method | Path | Returns / Body | Экран |
|---|---|---|---|
| GET | `/users/me/providers` | `[{id, connected, fields (masked)}]` | Settings |
| PUT | `/users/me/providers/{id}` | `{connected, fields}` (fields в plaintext, encrypt на сервере) | Provider toggle/save |
| POST | `/users/me/providers/{id}/test` | — → `{ok, latencyMs, error?}` | «Проверить соединение» |

### 3.10 WebSocket — live quotes

`WS /ws/quotes?token=...`

Сервер push'ит сообщения формата:

```json
{ "type": "quote", "assetId": "SBER", "price": 332.4, "ts": "2026-05-22T12:00:00Z" }
{ "type": "quote", "assetId": "BTC",  "price": 96420, "ts": "..." }
{ "type": "portfolio-tick", "portfolioId": "main", "total": 2840000, "dayPl": 12340 }
```

Клиент использует для обновления значений в Dashboard, Portfolio strip, KPI-виджетов без полного refetch.

### 3.11 Stage 5 — Risk endpoints

⚠️ Эти эндпоинты требуются `AGENT_PROMPT.md` Stage 5, но **UI для них в дизайне нет**. Возможные пути: новые widget'ы (в стилистике дизайна) или новые экраны. См. § Open Questions.

| Method | Path | Что считает |
|---|---|---|
| GET | `/portfolios/{id}/risk/beta?window=90&benchmark=IMOEX` | β активов и портфеля к рынку |
| POST | `/portfolios/{id}/risk/stress` body `{market_shock}` | Σ(weight_i × β_i × shock), плюс historical/parametric VaR (95, 99) |
| GET | `/assets/{id}/capm` | E(R) = R_f + β(E(R_m) − R_f) |
| GET | `/portfolios/{id}/risk/cml` | Точки CML + позиция портфеля |
| GET | `/portfolios/{id}/risk/sml` | Точки SML + активы как точки |
| GET | `/portfolios/{id}/risk/pairs` | Матрица регрессий R_i = α + β_ij·R_j + γ·R_market + ε |
| POST | `/tools/black-scholes` body `{S, K, r, T, sigma, type, marketPrice?}` | C, P, Δ, Γ, Vega, Θ, ρ; IV через Brent если задан marketPrice |
| GET | `/benchmarks` | Список доступных бенчмарков (T-Invest follow-leaders / CoinGecko indices) |
| GET | `/portfolios/{id}/compare?benchmark_id=...` | Sharpe/Sortino/MaxDD/Jensen α/tracking error vs benchmark |

---

## 4. Структура `apps/api`

```
apps/api/
├── pyproject.toml          # uv или poetry
├── alembic? → aerich.ini
├── src/curs_api/
│   ├── __init__.py
│   ├── main.py             # FastAPI app, lifespan, middleware
│   ├── settings.py         # Pydantic Settings, .env
│   ├── deps.py             # auth, db, redis deps
│   ├── auth/
│   │   ├── jwt.py
│   │   ├── password.py
│   │   ├── routes.py
│   │   └── schemas.py
│   ├── portfolios/         # routes + service
│   ├── assets/
│   ├── transactions/
│   ├── plans/
│   ├── analytics/          # metrics, frontier, mc endpoints
│   ├── risk/               # Stage 5 endpoints, wire to packages/finance-core
│   ├── providers/
│   ├── ws/
│   │   └── quotes.py       # /ws/quotes, redis subscription bridge
│   ├── integrations/
│   │   ├── moex.py         # ISS client
│   │   ├── coingecko.py    # public + Pro
│   │   └── cbr.py          # ключевая ставка ЦБ
│   ├── models/             # Tortoise ORM
│   ├── schemas/            # Pydantic v2
│   └── crypto/
│       └── fernet.py       # шифрование provider fields
├── tests/
└── README.md
```

## 5. Структура `apps/workers`

```
apps/workers/
├── pyproject.toml
├── src/
│   ├── quotes_worker.py
│   ├── portfolio_sync_worker.py
│   ├── risk_metrics_worker.py
│   └── common/
│       ├── redis_bus.py
│       ├── ratelimit.py
│       └── settings.py
```

Каждый worker — отдельный entrypoint в Dockerfile (`CMD ["python", "-m", "src.quotes_worker"]`).

## 6. Структура `packages/finance-core`

Pure Python lib (без FastAPI), импортируется и api, и workers. Stage 5 модели.

```
packages/finance-core/
├── pyproject.toml
├── src/finance_core/
│   ├── __init__.py
│   ├── returns.py          # log/simple returns, slicing
│   ├── beta.py             # Cov/Var, rolling
│   ├── capm.py
│   ├── cml.py
│   ├── sml.py
│   ├── frontier.py         # Markowitz analytical + Monte Carlo
│   ├── pairs.py            # multivar regression
│   ├── black_scholes.py    # price + greeks + Brent IV
│   ├── var.py              # historical, parametric
│   ├── stress.py
│   └── metrics.py          # vol, sharpe, sortino, max_dd, cagr, calmar, alpha, tracking_error
└── tests/                  # юнит-тесты со сверкой по учебникам
```

## 7. Структура `apps/mobile`

Жёстко FSD:

```
apps/mobile/
├── app.json, eas.json
├── package.json
├── src/
│   ├── app/                # navigation root, providers (QueryClient, theme)
│   ├── processes/          # многошаговые сценарии (если возникнут)
│   ├── pages/
│   │   ├── overview/
│   │   ├── portfolio/
│   │   ├── analytics/
│   │   ├── calc/
│   │   └── settings/
│   ├── widgets/
│   │   ├── portfolio-card/
│   │   ├── recent-tx-list/
│   │   ├── class-strip/
│   │   ├── analytics-widget/
│   │   └── plan-card/
│   ├── features/
│   │   ├── add-tx/
│   │   ├── add-asset/
│   │   ├── execute-plan/
│   │   ├── change-password/
│   │   └── provider-connect/
│   ├── entities/
│   │   ├── portfolio/
│   │   ├── asset/
│   │   ├── transaction/
│   │   └── plan/
│   └── shared/
│       ├── config/theme/   # токены 1-в-1 из DESIGN_SYSTEM.md
│       ├── ui/             # RN-компоненты: Button, Card, Pill, Tab, RangeTabs, AssetIcon, ClassChip, PercentDelta, Modal, ...
│       ├── api/            # TanStack Query клиенты, gen TS-типы
│       ├── ws/             # WebSocket клиент
│       └── lib/            # fmtRUB/fmtCcy/fmtPct/fmtQty, утилиты
```

## 8. Структура `packages/shared-types`

Авто-генерация TS-типов из OpenAPI (FastAPI exports). Скрипт: `pnpm run codegen`.

---

## 9. Безопасность

- JWT short-lived (15 min) + refresh (30 days). Refresh — rotating.
- Provider tokens (`MOEX token`, `CoinGecko apiKey`) хранятся как `bytes` в Postgres, шифруются Fernet с ключом `FERNET_KEY` из `.env`.
- Bcrypt для паролей.
- Rate limiting на `/auth/*` (slowapi или Redis-based).
- CORS — открыт для `web` и `mobile` origin'ов из `.env`.

---

## 10. Конфиг — `.env`

```env
# Domain
DOMAIN=                          # empty = localhost

# Postgres
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=curs
POSTGRES_USER=curs
POSTGRES_PASSWORD=...

# Redis
REDIS_URL=redis://redis:6379/0

# JWT
JWT_SECRET=...
ACCESS_TOKEN_TTL_MIN=15
REFRESH_TOKEN_TTL_DAYS=30

# Fernet (32 url-safe base64 bytes)
FERNET_KEY=...

# External APIs (defaults, можно перебить per-user)
MOEX_BASE_URL=https://iss.moex.com/iss
COINGECKO_BASE_URL=https://api.coingecko.com/api/v3
COINGECKO_API_KEY=               # серверный ключ (для глобальной выкачки бенчмарков)
CBR_BASE_URL=https://www.cbr.ru

# Workers
QUOTES_POLL_INTERVAL_SEC=12
COINGECKO_FREE_RPM=30
```

---

## 11. Точки расширения

- **Сделать DIVIDEND опциональным справочником** — на MVP можно не наполнять, дивиденды как сделки `div` уже моделируют выплаты вручную.
- **Партиционирование `QUOTE`** — отложить до момента, когда таблица перевалит за 50М строк.
- **BENCHMARK seed** — на старте: IMOEX (через MOEX ISS), TOTAL market cap (CoinGecko global), BTC (CoinGecko coins/bitcoin). Sp500 — отдельный источник (Yahoo Finance/Stooq), но не в MVP.
- **Multi-currency portfolio reporting** — пока всё в RUB (как в дизайне). Изменение base — отдельная задача, требует UI.
