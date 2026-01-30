# CURS Portfolio Tracker

Self-hosted приложение для управления инвестиционным портфелем с риск-аналитикой (CAPM, CML, SML, Black-Scholes, β, парные корреляции, Monte Carlo). Исходный дизайн — в `design/`, эталон в корне (`CURS Portfolio Tracker.html`).

## Структура

```
.
├── CURS Portfolio Tracker.html    # дизайн-эталон, не трогать
├── design/                        # копия эталона + расщеплённые JSX/CSS + чаты
├── docs/                          # DESIGN_SYSTEM.md, SCREENS_MAP.md, ARCHITECTURE.md
├── apps/
│   ├── api/                       # FastAPI + Tortoise + Redis + WS
│   ├── workers/                   # Async polling: quotes, sync, risk metrics
│   └── mobile/                    # React Native + Expo (FSD) — Этап 4
├── packages/
│   ├── shared-types/              # OpenAPI → TS типы — Этап 2
│   └── finance-core/              # Python lib для Stage 5 финформул
├── infra/
│   ├── docker-compose.yml         # base (dev)
│   ├── docker-compose.prod.yml    # overlay для prod с Traefik+ACME
│   ├── traefik/
│   └── .env.example
├── PROGRESS.md                    # прогресс по этапам
└── AGENT_PROMPT.md                # исходный промпт
```

## Быстрый старт (dev)

```bash
# 1) Скопировать env
cp infra/.env.example infra/.env

# 2) Сгенерировать секреты и подставить в infra/.env
openssl rand -hex 32                                                                    # → POSTGRES_PASSWORD
openssl rand -hex 64                                                                    # → JWT_SECRET
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"  # → FERNET_KEY

# 3) Поднять стек
docker compose -f infra/docker-compose.yml --env-file infra/.env up -d

# 4) Проверить
curl http://localhost:8000/health
# → {"ok": true, "db": true, "redis": true}

# 5) Traefik dashboard (dev only)
open http://localhost:8080
```

Или через npm-script-обёртки из корня:

```bash
pnpm run up      # = docker compose up -d
pnpm run logs    # = docker compose logs -f
pnpm run down    # = docker compose down
```

## Запуск в проде

1. Задать `DOMAIN=curs.example.com` и `ACME_EMAIL=you@example.com` в `infra/.env`.
2. Сгенерировать basic-auth для Traefik dashboard и вставить хэш в `infra/traefik/dynamic/middlewares.yml`:
   ```bash
   htpasswd -nB admin
   # → admin:$2y$05$abc...   — продублировать $ → $$ перед вставкой
   ```
3. Указать DNS A-записи `api.curs.example.com` и `traefik.curs.example.com` на сервер.
4. Открыть порты 80 и 443 на хосте.
5. Запустить:
   ```bash
   pnpm run up:prod
   ```
   Traefik автоматически выпустит Let's Encrypt сертификат через TLS-ALPN-01 (нужен открытый 443).

## Здоровье сервисов

| Сервис | Endpoint/Check |
|---|---|
| `api` | `GET /health` → `{ok, db, redis}` |
| `postgres` | `pg_isready` |
| `redis` | `redis-cli ping` → `PONG` |
| `workers` | mtime `/tmp/curs-worker.heartbeat` ≤ 60s |
| `traefik` | `traefik healthcheck --ping` |

Все 5 healthchecks внутри `docker-compose.yml`. `docker compose ps` покажет статус.

## Управление пользователями (после Этапа 2)

Регистрация публично закрыта (self-hosted). Юзеров создаёт админ через CLI:

```bash
docker compose exec api python -m curs_api.cli users create --email you@curs.local --password ...
docker compose exec api python -m curs_api.cli users list
docker compose exec api python -m curs_api.cli users set-password --email you@curs.local
docker compose exec api python -m curs_api.cli users delete --email you@curs.local
```

## Документация

- [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) — токены, типографика, состояния, инвентарь компонентов.
- [`docs/SCREENS_MAP.md`](docs/SCREENS_MAP.md) — карта 5 экранов + 3 модалок + структура данных.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — топология, ER-диаграмма, полный API-контракт.
- [`PROGRESS.md`](PROGRESS.md) — журнал по этапам.
- [`AGENT_PROMPT.md`](AGENT_PROMPT.md) — исходное ТЗ.
