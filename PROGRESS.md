# CURS — Progress

Журнал по этапам из `AGENT_PROMPT.md`. После каждого этапа — чек-лист и краткое демо.

---

## Этап 0 — Анализ дизайна и план

**Статус:** ✅ выполнен, ждёт подтверждения.

### Сделано

- [x] Получен design handoff bundle с claude.ai/design (gzipped tar, 11MB → распакован).
- [x] Бандл разложен: стандалон-HTML → корень проекта; копия + source-папка с JSX/CSS → `design/`.
- [x] Прочитан HTML-шелл `design/source/CURS Portfolio Tracker.html` (49 строк) и все 10 связанных файлов: `styles.css`, `data.js`, `app.jsx`, `ui.jsx`, `dashboard.jsx`, `portfolio.jsx`, `analytics.jsx`, `calc.jsx`, `settings.jsx`, `modals.jsx`, `charts.jsx` (выборочно), `tweaks-panel.jsx` (имена).
- [x] Прочитаны чат-транскрипты `design/chats/chat2.md`, `chat3.md` — извлечена авторская интенция: «НЕ УСЛОЖНЯЙ», 3 класса активов, 4 типа сделок, аналитика как кастомный widget-dashboard, Планировщик с executable-планами.
- [x] Создан скелет монорепо: `apps/{api,workers,mobile}`, `packages/{shared-types,finance-core}`, `infra/traefik/dynamic`, `docs/`, `design/{source,chats,HANDOFF_README.md}`.
- [x] Написан `docs/DESIGN_SYSTEM.md` — токены (цвета, типографика, геометрия, тени), состояния, компонентный инвентарь.
- [x] Написан `docs/SCREENS_MAP.md` — 5 экранов + 3 модалки + структура данных + endpoint-требования + mobile-адаптация.
- [x] Написан `docs/ARCHITECTURE.md` — топология сервисов, ER-диаграмма (mermaid), API-контракт строго под экраны + Stage 5 эндпоинты, структура каждого приложения, конфиг `.env`.
- [x] Заполнены memory-записи о пользователе и проекте.

### Итоговая структура каталога

```
/home/fiornrrn/code/curs/
├── AGENT_PROMPT.md                       # исходный промпт
├── CURS Portfolio Tracker.html           # standalone HTML, в корне (не трогать)
├── PROGRESS.md                           # this file
├── design/
│   ├── CURS Portfolio Tracker.html       # копия standalone для версионирования
│   ├── HANDOFF_README.md
│   ├── chats/                            # чат-транскрипты дизайна
│   └── source/                           # расщеплённая копия (HTML + JSX + CSS + screens + uploads)
├── docs/
│   ├── DESIGN_SYSTEM.md
│   ├── SCREENS_MAP.md
│   └── ARCHITECTURE.md                   # ER + API
├── apps/
│   ├── api/                              # пустой, для Stage 2
│   ├── workers/                          # пустой, для Stage 3
│   └── mobile/                           # пустой, для Stage 4
├── packages/
│   ├── shared-types/                     # пустой
│   └── finance-core/                     # пустой, для Stage 5
└── infra/
    └── traefik/dynamic/                  # пустой, для Stage 1
```

### Демо (быстрая проверка)

Открыть `CURS Portfolio Tracker.html` в браузере → загружается React-прототип целиком (всё инлайнено). Это эталон. Source-форма с разделёнными JSX лежит в `design/source/`.

---

## ✅ Резолюции по блокирующим вопросам (2026-05-25)

- **A. Источники данных** → **T-Invest + CoinGecko** (по `AGENT_PROMPT.md`, поверх дизайна). В Settings карточка MOEX заменяется на T-Invest (OAuth-токен, Fernet-шифрование). CoinGecko и автоматический ЦБ РФ для валют остаются.
- **B. Stage 5 риск-модули** → все 8 модулей встраиваются как **виджеты в Analytics** (через галерею виджетов, которая для этого спроектирована). Никакие риск-метрики не утекают на Portfolio или Dashboard. Конкретно:
  - 5.1 β актива/портфеля → виджет `kpi-beta` (xs)
  - 5.2 Стресс-тест + VaR 95/99% → виджет `stress-var` (full)
  - 5.3 CAPM (alpha-Дженсена портфеля и E(R) активов) → виджеты `kpi-capm`, `assets-capm-table`
  - 5.4 CML → расширение `frontier` виджета (toggle «Показать CML»)
  - 5.5 SML → новый виджет `sml-line` (lg)
  - 5.6 Парные регрессии → расширение `corr-pairs` (добавить α, β_ij, R²) или новый `pair-regression`
  - 5.7 Black-Scholes → виджет `bsm-calc` (full)
  - 5.8 Benchmark compare → расширение `equity` (dropdown бенчмарка) + новый виджет `benchmark-compare` (full)
- **C. Auth** → только экран **Login** (email + password). Регистрация — через CLI-скрипт `python -m curs_api.cli users create` (self-hosted продукт). Endpoint `/auth/register` не пишем.

## Резолюции по нестрого-блокирующим (мои дефолты, можешь оспорить)

- **D. Plans** → серверно (`TRANSACTION_PLAN` таблица + endpoints `/users/me/plans/*`). Локалсторадж убираем.
- **E. Analytics layout** → серверно (`ANALYTICS_LAYOUT` таблица). Локалсторадж убираем.
- **F. Лендинг** → скипнут на MVP. Если понадобится — добавим `apps/web` отдельным проектом после Stage 6.
- **G. Mobile-only стек** → строго по `AGENT_PROMPT.md`: фронт = только `apps/mobile` (RN + Expo + FSD). Веб-версии нет. Тестировать на iOS/Android симуляторе.
- **H. Зарубежные акции (AAPL/NVDA)** → через T-Invest (он торгует и российскими, и зарубежными, и крипту умеет — закрывает почти всё). Stooq fallback не нужен.
- **I. Today** → seed-данные используют `2026-05-22`; прод-эндпоинты — `now()`.
- **J. Каталог виджетов** → авторы и `installs` зашиты в код (статичная декорация); никакого «комьюнити-маркета».

---

## Изменения в `docs/*` по резолюциям

- `docs/SCREENS_MAP.md` § Settings: переписать карточку MOEX как T-Invest (структура полей и стиль — те же).
- `docs/SCREENS_MAP.md` § Analytics: добавить 8 новых виджетов Stage 5 в реестр.
- `docs/SCREENS_MAP.md` добавить экран **Login** (минимальный).
- `docs/ARCHITECTURE.md` § Providers: `tinkoff` вместо `moex` в `PROVIDER_CONNECTION.provider`. CLI-команды для users.
- `docs/ARCHITECTURE.md` § Endpoints: убрать `/auth/register`.

Эти правки внесу одной пачкой перед Этапом 2 (когда буду писать API под экраны). Сейчас они зафиксированы здесь — этого достаточно, чтобы Этап 1 (инфра) не блокировался.

---

## 🔑 Запрос на дев-токены (требование `AGENT_PROMPT.md`)

Для Этапа 3 (интеграции) понадобятся:

1. **T-Invest token** — лучше **read-only** sandbox-токен. Получить: https://www.tbank.ru/invest/settings/api/ → создать новый токен → пометить как «только чтение». Для разработки достаточно sandbox-токена (там лимиты мягче).
2. **CoinGecko API key** — для разработки достаточно **бесплатного Demo-плана** (30 req/min). Получить: https://www.coingecko.com/en/api/pricing → Demo. Если хочешь Pro/Analyst — токен тоже пригодится.

Токены клади в `infra/.env` (`TINKOFF_DEV_TOKEN`, `COINGECKO_API_KEY`) — этот файл уже добавлен в `.gitignore` (если нет — добавлю на Этапе 1). Альтернатива — `.env.local` рядом с `.env.example`. Для Этапа 1 (только инфра) они не нужны — можно отдать перед Этапом 3.

---

## Что отрезаем по правилу «не добавляй экранов» — отдельный список

Не добавляем (формально требовалось бы по Stage 5/6, но решили иначе):
- Отдельный экран «Калькулятор» в сайдбаре (Black-Scholes → виджет).
- Отдельный экран «Бенчмарки» в сайдбаре (benchmark-compare → виджет).
- Колонки β/CAPM в таблице позиций Portfolio (всю аналитику в Analytics).
- Лендинг (отложен).
- Регистрация в UI (CLI).

## ❗ Старые Open Questions (история — для аудита)

### A. Источники данных — конфликт с дизайном

**Контекст:** `AGENT_PROMPT.md` § «Источники данных» жёстко требует Tinkoff Invest API (T-Invest) и CoinGecko. Дизайн (`design/source/settings.jsx`) показывает экран Настроек с двумя провайдерами: **MOEX ISS** и **CoinGecko**. T-Invest в дизайне нигде нет.

**Что делать?** (выбрать одно):

1. **Идти по дизайну** — MOEX ISS (для tradfi: акции/облигации/ETF РФ) + CoinGecko (для крипты). Tinkoff Invest пропускаем. У зарубежных тикеров (`AAPL`, `NVDA`) — статичный fallback или подключаем третий источник (Yahoo Finance/Stooq).
2. **Идти по промпту** — реализовать T-Invest интеграцию, заменить MOEX-карточку на T-Invest в UI Settings (это нарушит правило «не убирай экраны/компоненты»).
3. **Гибрид** — MOEX + CoinGecko по дизайну, плюс ОПЦИОНАЛЬНО T-Invest как третий провайдер (новая карточка в Settings — это нарушит правило «не добавляй компонентов»).

**Моя рекомендация:** **№1** (MOEX + CoinGecko). Авторская интенция явно прописана в чате (`chat3.md`): «MOEX (для трад. финансов) и CoinGecko (для крипты)... Внизу подсказка, что валюты подгружаются автоматически с ЦБ». Это перевешивает строку в `AGENT_PROMPT.md`. Иностранные акции в дизайне есть (AAPL/NVDA), но в `SettingsScreen` нет ни одного провайдера, который их отдаёт — спросить, должны ли мы их вообще иметь, или они присутствуют только как демонстрация мультивалютности.

### B. Stage 5 риск-модули без UI

**Контекст:** `AGENT_PROMPT.md` Stage 5 требует CAPM, CML, SML, парные регрессии, Black-Scholes, бенчмарк-сравнение. В дизайне:
- **CML/Markowitz** частично покрыт виджетом `frontier` (но это efficient frontier через симуляцию, не точно CML).
- **Корреляции** есть (`correlation`, `corr-pairs`) — но не парные регрессии с α/β_ij/R²/γ.
- **CAPM, SML, Black-Scholes, стресс-тест, VaR, полный benchmark-compare экран** — отсутствуют.

Правило 1 из `AGENT_PROMPT.md`: «Не добавляй экранов и компонентов, которых нет в HTML».

**Что делать?**

1. **Расширить существующие виджеты** — добавить CAPM/SML/VaR/Beta как новые виджеты в каталоге аналитики (галерея виджетов — точка расширения, заявленная самим дизайном). Black-Scholes — новый виджет «Калькулятор опционов». Benchmark compare — расширение `equity` widget'а (добавить multi-benchmark overlay). Это **минимально нарушает правило** (виджеты — это экспансия по архитектуре, не новые экраны).
2. **Добавить новый раздел в сайдбар** (например, «Риск» или «Калькуляторы») — явное нарушение правила.
3. **Скипнуть Stage 5 UI** — реализовать только endpoints, без визуализаций. UI допилить позже по согласованию.

**Моя рекомендация:** **№1** — все Stage 5 фичи как «community widgets» в Analytics (с подписью «Black-Scholes calculator @curs-team», и т.д.). Black-Scholes — единственная фича, которая просится в полноценный экран-калькулятор (там 6 inputs и 5 outputs), но можно тоже сделать как `widget[size=full]`. Подтверди, или предложи другое.

### C. Login / Register UI

**Контекст:** Auth (JWT) требуется по Stage 2. В дизайне нет ни login-экрана, ни register-экрана, ни user-menu (только статичная user-card в сайдбаре с прибитым именем «Максим Родиков»).

**Что делать?**

1. Сделать тонкий login/register экран в стилистике дизайна (использовать те же tokens, modal-style). Это **новый экран, не из дизайна** — формально нарушает правило, но de-facto без login приложение не работает.
2. На MVP — без auth (single seed-user, full open API). Auth добавить отдельно после согласования.
3. Спросить — может, у тебя есть скрин login'а или ты ожидал, что я его опущу.

### D. Transaction plans — серверно или локально?

**Контекст:** В дизайне Calc-планы хранятся в `localStorage.curs.calc.plans.v2`. Это значит, что между устройствами планы не синкаются. Если будет mobile + web — придётся выбирать.

**Что делать?**

1. **Хранить серверно** — добавить `TRANSACTION_PLAN` таблицу (уже в ER), endpoints `/users/me/plans/*`, синк между устройствами.
2. **Оставить локально** — как в прототипе. Mobile не видит web-планы и наоборот.

**Моя рекомендация:** **№1** — раз делаем бэкенд, имеет смысл держать там. Дешёво.

### E. Analytics layout — серверно или локально?

То же самое для `localStorage.curs.analytics.widgets`. **Рекомендую серверно** (endpoint в ARCHITECTURE.md уже описан).

### F. Лендинг

**Контекст:** В бандле есть `design/source/CURS Landing.html` + `landing.jsx` + `landing.css` — публичная страница «о проекте» с community widgets showcase и submit-формой. В `AGENT_PROMPT.md` лендинг не упомянут.

**Что делать?**

1. Реализовать лендинг как отдельный `apps/web` (Next.js / Vite static) — будет публичной точкой входа.
2. Скипнуть — фокус только на app.
3. Реализовать «как-нибудь потом», после ядра.

**Моя рекомендация:** **№2 пока, потом №1**. Лендинг — украшение, не блокирует Stage 1–6.

### G. Mobile-only стек

**Контекст:** `AGENT_PROMPT.md` под фронт упоминает только `apps/mobile` (React Native + Expo). Дизайн **десктоп-first** (viewport 1440px). В бандле есть `CURS Mobile.html` — но это статичный мокап мобильной адаптации, не отдельная архитектура.

**Что делать?**

1. Реализовать **только мобильное приложение** — десктоп-дизайн адаптировать под мобилу (как в `CURS Mobile.html`). Это явный путь из промпта.
2. Реализовать веб-версию (`apps/web`, например, Vite + React) **дополнительно**, чтобы можно было сидеть с ноута.
3. Реализовать только web.

**Моя рекомендация:** **№2** — web-версия один-в-один из HTML-эталона (десктоп), mobile отдельно по mobile.html. Это удвоит работу Stage 4, но даст полный продукт. Можно сделать **№1**, если приоритет — строго следовать промпту.

### H. Зарубежные тикеры и валюты

**Контекст:** В seed-данных есть `AAPL`, `NVDA` (USD), `EUR`, и нет публичного бесплатного источника для US-акций в нашем стеке.

**Что делать?**

1. Реализовать **только RU и крипту** — убрать AAPL/NVDA из дефолтных данных. Это противоречит дизайну.
2. Подключить **Stooq** или **Yahoo Finance** (без API key, простой CSV) для US-тикеров — это новый источник, не в дизайне.
3. Захардкодить mock-цены для US — это макет, не прод.

**Моя рекомендация:** **№2** — Stooq как fallback для зарубежных tradfi, без отдельной карточки в Settings (использовать без user config).

### I. `today = 2026-05-22` в данных

**Контекст:** В `data.js` дата захардкожена для воспроизводимости. Backend, разумеется, будет работать с реальным временем. При seed-данных для тестов — какую дату ставить?

**Решение:** seed-сценарии в тестах используют `2026-05-22` (соответствует дизайну), live-серверные эндпоинты — `now()`. Никакого вопроса, просто фиксирую.

### J. WidgetGallery — реестр виджетов

**Контекст:** В дизайне 14 виджетов с авторами (`@quant_ru`, `@markowitz_ru`, и т.д.) и счётчиками установок. Это полностью статика. В проде:

1. Оставить как статику (виджеты — это код, не данные).
2. Сделать `installs` динамическим (счётчик по подпискам), `author` оставить статикой.
3. Полноценная «комьюнити» — авторы могут публиковать виджеты (огромный scope).

**Моя рекомендация:** **№2** — `installs` подсчитываем по числу `ANALYTICS_LAYOUT` с этим id; авторы зашиты в код. Реально полезного — мало, но дёшево.

---

## Этап 1 — Инфраструктура

**Статус:** ✅ выполнен.

### Сделано

- [x] `infra/docker-compose.yml` (dev base): postgres 16 + redis 7 + api + workers + traefik 3.1, единая сеть `curs`, named volumes, health-чек на каждом сервисе. Postgres/Redis наружу не светятся (доступны только внутри сети), api на `localhost:${API_PORT}`, traefik dashboard на `localhost:${TRAEFIK_DASHBOARD_PORT:-8088}`.
- [x] `infra/docker-compose.prod.yml` (overlay): `!reset` снимает dev-биндинги; добавляет Traefik labels с Let's Encrypt (TLS-ALPN-01) на `https://api.${DOMAIN}` и защищённый basic-auth dashboard на `https://traefik.${DOMAIN}`.
- [x] `infra/traefik/traefik.yml` — один конфиг работает и в dev (insecure dashboard), и в prod (через docker overlay). Entrypoints `web/websecure/traefik`, file+docker providers, ACME tlsChallenge.
- [x] `infra/traefik/dynamic/middlewares.yml` — `security-headers` (HSTS, frameDeny, etc.) и заготовка `traefik-auth` (htpasswd слот).
- [x] `infra/.env.example` — закомментированный шаблон со всеми переменными (DOMAIN/ACME, Postgres, Redis, JWT, Fernet, T-Invest, CoinGecko, CBR, intervals, log).
- [x] `apps/api/` — FastAPI скелет (Python 3.12, uv, Tortoise+asyncpg, Redis async, structlog, Pydantic Settings). Multi-stage Dockerfile с uv builder. Endpoints `/health`, `/health/db`, `/health/redis` ходят в Postgres и Redis по-настоящему.
- [x] `apps/workers/` — async-loop stub (supervisor с heartbeat + idle-loop, structlog). Multi-stage Dockerfile. Healthcheck — mtime файла-heartbeat ≤ 60s.
- [x] Корневые: `package.json` (pnpm-обёртки `up`/`up:prod`/`down`/`logs`), `pnpm-workspace.yaml`, `.gitignore`, `README.md` с инструкциями.
- [x] Smoke-test пройден: все 5 контейнеров **healthy**, `/health` → `{"ok":true,"db":true,"redis":true}`, structlog работает, Traefik dashboard отвечает.

### Демо

```bash
$ docker compose -f infra/docker-compose.yml --env-file infra/.env ps
curs-api-1        Up (healthy)   127.0.0.1:8089->8000/tcp
curs-postgres-1   Up (healthy)   5432/tcp
curs-redis-1      Up (healthy)   6379/tcp
curs-traefik-1    Up (healthy)   127.0.0.1:8088->8080/tcp
curs-workers-1    Up (healthy)

$ curl -s http://localhost:8089/health
{"ok":true,"db":true,"redis":true}

$ curl -s http://localhost:8088/api/version
{"Version":"3.1.7","Codename":"comte",...}
```

### Гочи и заметки

- В dev pg/redis наружу не светим намеренно — конфликтуют с локально установленными pg/redis. Для отладки — `docker compose exec`.
- API_PORT и TRAEFIK_DASHBOARD_PORT настраиваемые через .env (дефолты 8000/8088). В моей машине 8000/8080/6379 были заняты — выставил 8089/8088 в `.env`.
- Aerich-миграции пока не запускаем — нет ни одной модели. Запустим на Этапе 2 первой же миграцией с моделями Auth + Portfolio.
- Конкретная версия `uv` запинена через `ghcr.io/astral-sh/uv:0.5.4` в обоих Dockerfile.
- Workers пока не подключаются к Postgres/Redis — это stub Этапа 1. Реальные подключения с lifespan-init появятся на Этапе 3.

---

## Этап 2 — Бэкенд под дизайн

**Статус:** ✅ выполнен.

### Сделано

- [x] **12 Tortoise-моделей** (`User`, `Portfolio`, `Asset`, `Position`, `Transaction`, `TransactionLeg`, `TransactionPlan`, `Quote`, `Benchmark`, `Dividend`, `ProviderConnection`, `AnalyticsLayout`, `ModelParams`) + Aerich initial миграция (14 таблиц). Применяются автоматически через `entrypoint.sh` при старте api-контейнера.
- [x] **Auth** (JWT access + refresh через PyJWT, прямой bcrypt без passlib из-за несовместимости): `POST /auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/password`, `GET /auth/me`. Public `/auth/register` нет — для self-hosted.
- [x] **CLI** (`python -m curs_api.cli users ...`): `create`, `list`, `set-password`, `delete`, `disable`. Через Typer.
- [x] **finance-core** (Python lib, без зависимостей от FastAPI/ORM, подключён через `tool.uv.sources` в pyproject api): `returns`, `metrics` (vol/sharpe/sortino/maxDD/cagr/calmar), `structure`, `correlation`, `frontier` (Markowitz cloud + envelope), `montecarlo` (GBM с перцентилями), `monthly_returns`.
- [x] **CRUD-роуты** под `SCREENS_MAP.md`:
  - `/portfolios` (list/create/get/update/delete + positions)
  - `/assets` (list/create/get/quote/series)
  - `/transactions` (list/create/batch/delete) — полиморфные `in/out/tx/div`
  - `/users/me/plans` (list/create/update/delete/clear + execute/execute-all) — server-side хранение планов
  - `/users/me/providers` (list/upsert/test) — Fernet-шифрование секретов
  - `/users/me/analytics-layout` (get/put)
  - `/dashboard/overview`
- [x] **Аналитика 1-в-1 под Analytics виджеты дизайна**: `/portfolios/{id}/{metrics,series,structure,by-class,drawdown,correlation,frontier,monthly-returns}`, `POST /portfolios/{id}/montecarlo`.
- [x] **WebSocket** `/ws/quotes` — JWT auth по query token, подписка на Redis pub/sub канал `quotes:updates`, форвардинг клиенту.
- [x] **Seed-скрипт** (`python -m curs_api.seed`): 14 активов из дизайна + GBM-симуляция 365 дней котировок (5110 точек). Идемпотентно.
- [x] **Pytest**: 23 теста, 100% прошли. Покрытие: auth flow, CRUD portfolios, transactions (in/tx/list-filter), dashboard, layout, providers, плюс юнит-тесты finance-core.

### Демо

```bash
$ docker compose exec api python -m curs_api.cli users create --email=test@curs.local --password=TestPass123
Created user test@curs.local (id=ebb7189b-...)

$ docker compose exec api python -m curs_api.seed
[info] seed.asset created=True id=RUB
...
[info] seed.quotes count=365 id=SOL

$ curl -s -X POST http://localhost:8089/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"test@curs.local","password":"TestPass123"}'
{"user":{"id":"...","email":"test@curs.local",...},"accessToken":"eyJ...","refreshToken":"eyJ..."}

$ curl -s http://localhost:8089/portfolios/<id>/metrics?range=1Г -H "Authorization: Bearer ..."
{"vol":0.138, "sharpe":0.215, "sortino":0.306, "maxDd":-0.143, "cagr":0.0997, "calmar":0.696}

$ docker run --rm ... curs-api python -m pytest tests/ -q
23 passed, 13 warnings in 7.28s
```

### Гочи и заметки

- **passlib 1.7 несовместим с bcrypt ≥ 4.1** (`AttributeError: module 'bcrypt' has no attribute '__about__'`) — заменил на прямые `bcrypt.hashpw/checkpw` с явным sha256-префиксом для паролей > 60 байт (bcrypt молча режет на 72).
- **`pydantic.EmailStr` отвергает `.local` TLD** — заменил на regex-валидацию в `LoginRequest`.
- **Aerich init-db** запускал через временный контейнер с bind-mount на `migrations/` (нужны права записи; runtime контейнер от user `curs` без write на `/app`).
- **Кириллица в query** (`?range=1Г`) — клиент должен URL-encode'ить (curl без `--data-urlencode` падает на uvicorn parser). API эндпоинт сам — OK.
- **Тесты ASGI**: function-scope Tortoise init обязателен из-за pytest-asyncio event loop'ов; session-scope ломал второй тест с `Event loop is closed`.
- **Финансовый дизайн** — для расчётов используются курсы из `Asset.current_price` (актуальные) и `Quote` time-series (для метрик / графиков). Workers Stage 3 заменят seed-данные на реальные котировки от T-Invest/CoinGecko.
- **WebSocket** пока пустой канал — публикации появятся в Stage 3, когда воркеры начнут писать в `quotes:updates`.

### Файлы

```
apps/api/
├── pyproject.toml         # uv + finance-core local source
├── Dockerfile             # multi-stage с aerich entrypoint
├── entrypoint.sh
├── migrations/models/0_*.py
├── src/curs_api/
│   ├── main.py            # lifespan + 10 routers + /health
│   ├── settings.py
│   ├── db.py              # TORTOISE_ORM config
│   ├── deps.py            # get_current_user
│   ├── seed.py
│   ├── cli.py             # users management
│   ├── auth/
│   │   ├── password.py    # прямой bcrypt
│   │   ├── jwt_tokens.py
│   │   └── fernet_util.py
│   ├── models/            # 12 моделей
│   ├── schemas/           # Pydantic v2 DTOs
│   ├── services/valuation.py
│   └── routes/
│       ├── auth.py
│       ├── portfolios.py
│       ├── assets.py
│       ├── transactions.py
│       ├── plans.py
│       ├── providers.py
│       ├── layout.py
│       ├── dashboard.py
│       ├── analytics.py
│       └── ws.py          # /ws/quotes Redis pub/sub bridge
└── tests/                 # 23 tests, all green

packages/finance-core/
└── src/finance_core/
    ├── returns.py
    ├── metrics.py
    ├── structure.py
    ├── correlation.py
    ├── frontier.py
    ├── montecarlo.py
    └── monthly_returns.py
```

---

## Этап 3 — Интеграции T-Invest и CoinGecko

**Статус:** ✅ выполнен.

### Решения пользователя
- **1a** — динамический FIGI-резолвер: каталог 14 активов из seed остаётся, `Asset.tinkoff_figi` резолвится on-demand через `InstrumentsService/FindInstrument` и кэшируется в БД.
- **2c** — бэкфилл реальной 365-дневной истории при первом запуске воркера (T-Invest candles + CoinGecko market_chart), реальные точки заменяют seed.

### Сделано

- [x] `integrations/cache.py` — общий async Redis-клиент, TTL JSON-кэш, `publish()`, `RateLimiter` (sliding-window token bucket в Redis для CoinGecko 30/min).
- [x] `integrations/coingecko.py` — async httpx: `/ping`, `/simple/price`, `/coins/{id}/market_chart`, `/global` (TOTAL mcap, кэш 1ч). Tenacity backoff на 429/5xx, rate-limit через Redis.
- [x] `integrations/tinkoff.py` — **REST-gateway** (`invest-public-api.tinkoff.ru/rest`) поверх httpx, зеркалит gRPC-контракт 1:1: `FindInstrument`, `GetLastPrices`, `GetCandles`, `GetAccounts`, `GetPortfolio`, `GetOperations`, `GetInfo`. Quotation→float. Tenacity backoff.
- [x] `integrations/cbr.py` — ЦБ РФ: курсы валют (`XML_daily.asp`, кэш 1ч) + ключевая ставка (fallback 0.16, кэш 12ч).
- [x] **Воркеры** (заменили Stage-1 stub): `quotes_worker` (поллинг 12с → Quote + Asset.current_price + publish в `quotes:updates`, дневная персистенция), `portfolio_sync_worker` (синк позиций/дивидендов для connected-юзеров, токен из Fernet), `risk_metrics_worker` (пересчёт RiskSnapshot по 5 диапазонам). Supervisor запускает три через `asyncio.gather` с авто-рестартом и экспоненциальным backoff.
- [x] `backfill.py` — идемпотентный бэкфилл 365д (по флагу «есть >200 не-seed котировок»).
- [x] Модель **RiskSnapshot** + Aerich-миграция `1_*_add_risk_snapshot` (15 таблиц).
- [x] `ProviderConnection.test()` — реальные вызовы: CoinGecko `/ping`, T-Invest `GetInfo`.
- [x] +4 юнит-теста интеграций (quotation conversion, ticker map, params) — **27/27 тестов зелёные**.

### Демо (вживую с реальными токенами)

```text
backfill.complete assets=14 points=2081     # реальная история залита
quotes_worker.tick updated=9                 # T-Invest + CoinGecko + ЦБ
risk_metrics_worker.tick snapshots=5
portfolio_sync_worker.tick users=0

quotes by source:  coingecko:1098  tinkoff:987  seed:2555

# реальные текущие цены: BTC $77262, AAPL $308.4, SBER 332.4₽, USD 71.21₽ (ЦБ)
# portfolio detail: total≈3.34М ₽, P&L +9.71% — оценка по живым ценам

POST /users/me/providers/coingecko/test → {"ok":true,"latencyMs":362}
POST /users/me/providers/tinkoff/test   → {"ok":true,"latencyMs":386}
# секреты в БД зашифрованы Fernet, в ответах маскированы: token=***uSAg, apiKey=***6bSy

WS /ws/quotes: publish в Redis → клиент получил сообщение (end-to-end)
```

### Гочи и заметки

- **`tinkoff-investments` SDK снят с PyPI (404)** — ребрендинг T-Bank / санкции; `pip`/`uv` не находят ни одной версии. Решение: вместо официального gRPC-SDK реализовал клиента через публичный **REST-gateway** T-Invest (`/rest/<package>.<Service>/<Method>`, Bearer-токен) поверх httpx. Контракт идентичен gRPC, ничего ломающегося не тянем. ⚠️ Отклонение от `AGENT_PROMPT.md` (там «официальный gRPC SDK») — вынужденное, SDK физически недоступен.
- **OFZ26240 (облигация)** — `FindInstrument` по тикеру не находит ОФЗ (нужен ISIN/спец-поиск), осталась на seed-цене. Акции/ETF/валюты/крипта — реальные. Для облигаций нужен отдельный lookup (Stage 6 / по требованию).
- **GAZP/VTBR** — `GetLastPrices` не вернул котировку (инструмент без активных торгов на сессии) → current_price на seed; история частично реальная. Норма для нерабочих часов рынка.
- **Workers-образ** переиспользует `curs_api` как path-зависимость (`tool.uv.sources`), Dockerfile сохраняет layout монорепо под `/repo`, чтобы транзитивные относительные path-deps резолвились.
- **naive datetime** — заменил все `datetime.utcnow()` на `datetime.now(timezone.utc)` в DB-facing коде (Tortoise `use_tz=True` ругался warning'ом в фильтрах по `ts`).
- **Sandbox-флаг** — market data (цены/свечи/инструменты) работает на проде-эндпоинтах с read-токеном независимо от `TINKOFF_SANDBOX`. Для песочных торговых счетов понадобился бы `SandboxService` — не нужно для текущего read-only сценария.

### Файлы Этапа 3

```
apps/api/src/curs_api/integrations/
├── cache.py          # Redis TTL-кэш + RateLimiter
├── coingecko.py      # crypto prices/history/global mcap
├── tinkoff.py        # REST-gateway client
└── cbr.py            # ЦБ РФ fx + key rate
apps/api/src/curs_api/models/risk_snapshot.py
apps/api/migrations/models/1_*_add_risk_snapshot.py
apps/workers/src/curs_workers/
├── db.py             # Tortoise bootstrap (reuse curs_api config)
├── backfill.py       # 365d history backfill (idempotent)
├── quotes_worker.py
├── portfolio_sync_worker.py
├── risk_metrics_worker.py
└── supervisor.py     # asyncio.gather + auto-restart
apps/api/tests/test_integrations.py
```

---

## Этап 4 — Фронт под дизайн

**Статус:** ✅ выполнен (JS-бандл собирается, типы чисты; визуальная сверка — на симуляторе пользователя).

### Решения пользователя
- **Пакетный менеджер — yarn** (не pnpm: Expo/Metro конфликтуют с симлинками). `apps/mobile` вынесен из `pnpm-workspace.yaml`.
- Мобильный эталон — `design/source/mobile.{jsx,css}` (bottom-tabs, warm-cream палитра).

### Сделано

- [x] **Expo SDK 52** проект (RN 0.76, React 18, new architecture) с конфигом: `app.json`, `tsconfig` (алиас `@/*`), `babel.config.js` (module-resolver + reanimated), `metro.config.js`, `index.ts`, `App.tsx`.
- [x] **Строгая FSD**: `app/` (providers, navigation), `pages/`, `widgets/`, `features/`, `entities/`, `shared/`.
- [x] **Дизайн-система 1-в-1** из mobile.css → `shared/config/theme/tokens.ts`: цвета (warm cream), класс-цвета, asset-icon палитра, chart-палитра, радиусы, отступы, шрифты (mono для чисел), тени.
- [x] **shared/ui примитивы**: `Txt`, `Card`, `Button`, `FilterPill`/`RangePill`/`SegButton`/`Chip`, `Toggle`, `AssetIcon`, `PercentDelta`, `SectionTitle`/`SectionLabel`, `Field`/`Input`/`Select`, `Sheet` (bottom-sheet), `Screen`.
- [x] **Графики на Skia** (по требованию промпта): `Sparkline`, `LineAreaChart` (сглаживание Catmull-Rom + градиент-площадь), `Donut`, `Treemap`.
- [x] **API-слой**: `client.ts` (fetch + авто-refresh JWT при 401, дедуп refresh), `hooks.ts` (TanStack Query — все эндпоинты), `types.ts` (DTO camelCase). `store/auth.ts` (Zustand + expo-secure-store). `ws/useQuotesSocket.ts` (live-котировки, авто-reconnect с backoff).
- [x] **Экраны (6)**: Login (decision C), Обзор, Портфель (push из Обзора), Аналитика, Планировщик, Настройки — все подключены к реальному API.
- [x] **Навигация**: RootNavigator (auth-гейт по токену) → bottom-tabs с кастомным таб-баром (Обзор · Планировщик · ⊕ · Аналитика · Настройки, центральная «+» открывает AddTxSheet) + native-stack Обзор↔Портфель.
- [x] **Фичи**: AddTxSheet (6 типов, постит реальную сделку), PlanFormSheet (создаёт план), ChangePasswordSheet, ProviderSheet (T-Invest/CoinGecko connect + test).
- [x] **Настройки = T-Invest + CoinGecko** (decision A): карточка MOEX из эталона заменена на Т-Инвестиции (OAuth-токен), CoinGecko рядом, подсказка про ЦБ РФ.

### Демо / верификация

```bash
$ cd apps/mobile && yarn install        # ok
$ yarn typecheck                         # tsc --noEmit → 0 ошибок
$ npx expo export --platform ios         # ✓ ios bundle (Hermes), импорты/Skia/nav резолвятся
$ npx expo export --platform web         # ✓ web bundle (code-split: CanvasKit → App)
```

### Web-поддержка

- `platforms: [ios, android, web]`, web-бандлер metro, `output: single`.
- Зависимости: `react-dom`, `react-native-web`, `@expo/metro-runtime`.
- **Skia на web** — CanvasKit (WASM) грузится в рантайме до монтирования: `index.web.ts` вызывает `LoadSkiaWeb` (canvaskit-wasm 0.39.1 с CDN, версия = зависимость Skia), затем `registerRootComponent(App)`. `main: "index"` (без расширения) → Metro выбирает `index.web.ts`/`index.ts` по платформе.
- **CORS**: backend получил `allow_origin_regex` для любого localhost-порта (Expo web :8081 и т.п.).
- `apps/mobile/.env` (gitignored): `EXPO_PUBLIC_API_URL=http://localhost:8089` — web/симулятор бьют в хост-маппинг бэкенда. WS выводится из API-URL заменой http→ws.

Запуск на устройстве: `yarn start` (Metro) → Expo Go / симулятор. Бэкенд поднят, юзер создан, каталог засеян.

### Гочи и заметки

- **react-native-svg не использовал** — графики на `@shopify/react-native-skia` (промпт явно требует Skia). Иконки — `@expo/vector-icons` (Feather), идёт с Expo.
- **Skia `<Canvas>` требует children** — пустой sparkline (нет данных) рендерит `<View>`, не `<Canvas/>`.
- **Шрифты Geist** на мобилке заменены системными (SF/Roboto) + `monospace` для чисел, как в мобильном эталоне (там SF Pro + JetBrains Mono). Можно подключить Geist через expo-google-fonts позже.
- **Запуск симулятора в этом окружении невозможен** → скриншоты для пиксель-сверки (критерий приёмки) снимет пользователь. Бандл собирается, типы чисты — структурная корректность подтверждена.
- **Android-эмулятор**: `localhost` → хост недоступен; `env.ts` поддерживает `EXPO_PUBLIC_API_URL` (напр. `http://10.0.2.2:8000`).

### Файлы Этапа 4

```
apps/mobile/
├── package.json (yarn) · app.json · tsconfig · babel · metro · index.ts · App.tsx
└── src/
    ├── app/{providers, navigation/{RootNavigator,MainTabs,HomeStack,CustomTabBar}}
    ├── pages/{login,overview,portfolio,analytics,calc,settings}
    ├── widgets/{ClassStrip,PortfolioRow}
    ├── features/{add-tx,add-plan}
    ├── entities/transaction/{TxRow,meta}
    └── shared/{config/theme,config/env,ui/*,ui/charts/*,api/*,store/auth,ws,lib/format}
```

---

## Этапы 5–6 — не начаты

**Этап 5 (Риск-менеджмент):** 8 модулей как виджеты Analytics (beta, stress+VaR, CAPM, CML, SML, парные регрессии, Black-Scholes, benchmark-compare) в `packages/finance-core` + `docs/FINANCE_MODELS.md`.

**Этап 6:** юнит-тесты формул со сверкой по учебникам, интеграционные/E2E, линтеры, Bruno-коллекция, скриншоты.
