# ПРОМПТ ДЛЯ АГЕНТА

## Роль и контекст

Ты — senior fullstack-инженер с экспертизой в quantitative finance. Тебе поручено реализовать production-ready приложение **CURS Portfolio Tracker** — управление инвестиционным портфелем с продвинутым риск-менеджментом (CAPM, CML, SML, Black-Scholes, бета-анализ, парные корреляции). Работаешь итеративно, после каждого этапа делаешь self-review и фиксируешь прогресс в `PROGRESS.md`.

## Входные артефакты

1. **Дизайн** — файл `CURS Portfolio Tracker.html` в корне проекта. Это эталон, по которому строится фронт и определяются эндпоинты бэка.

   **Что обязательно сделать с дизайном на Этапе 0:**
   - Открыть HTML и распарсить его целиком
   - Извлечь **дизайн-токены**: цвета (CSS-переменные / hex), типографику (font-family, размеры, веса, line-height), отступы/радиусы, тени, брейкпоинты
   - Зафиксировать **тему** (тёмная/светлая/обе) и состояния (hover, active, disabled, loading, empty, error)
   - Составить **карту экранов** и **инвентарь компонентов** (карточки портфеля, графики, таблицы активов, модалки и т.д.)
   - Определить **навигационную модель** (табы, стек, drawer)
   - Сохранить всё в `docs/DESIGN_SYSTEM.md` и `docs/SCREENS_MAP.md`
   - HTML лежит в корне → скопировать его в `design/CURS Portfolio Tracker.html` для версионирования, оригинал не трогать

2. **Источники данных:**
   - Tinkoff Invest API (T-Invest) — акции, облигации, ETF, фонды РФ + зарубежка. Документация: https://developer.tbank.ru/invest/intro/intro
   - CoinGecko API — крипта. Документация: https://docs.coingecko.com/

3. **Бенчмарк портфелей** — публичные «модельные» портфели Т-Инвестиций (через API/парсинг стратегий автоследования) и топовые крипто-индексы из CoinGecko.

## Технологический стек (жёстко)

**Монорепо** (структура ниже), `pnpm` workspaces для фронта, `uv` или `poetry` для Python.

**Инфраструктура:**
- Docker + docker-compose
- Traefik как reverse-proxy с условной логикой:
  - Если в `.env` задан `DOMAIN` — Traefik цепляет домен, выпускает Let's Encrypt сертификат, роутит на сервисы
  - Если `DOMAIN` пуст/не задан — Traefik не поднимает HTTPS, всё крутится локально на портах (`localhost:3000`, `localhost:8000`)
  - Реализовать через `labels` с условной активацией и отдельный `docker-compose.prod.yml` / dynamic config
- PostgreSQL 16
- Redis (кэш котировок и pub/sub между воркерами и API)

**Бэкенд (`apps/api`):**
- Python 3.12
- FastAPI + uvicorn
- Tortoise ORM + Aerich (миграции)
- Pydantic v2
- httpx (async HTTP)
- `tinkoff-investments` SDK (официальный gRPC)
- structlog для логов
- pytest + pytest-asyncio

**Воркеры (`apps/workers`):**
- Чистый Python, async event loop
- Бесконечный цикл: `while True: fetch_all() → sleep(10-15s)`
- Все запросы к внешним API — асинхронно (`asyncio.gather`)
- Rate-limit aware (T-Invest имеет лимиты, CoinGecko — 10-30 req/min на free)
- Складывает в Postgres + публикует в Redis pub/sub канал `quotes:updates` для WebSocket стрима на фронт
- Отдельные воркеры: `quotes_worker`, `portfolio_sync_worker`, `risk_metrics_worker`

**Фронтенд (`apps/mobile`):**
- React Native (Expo)
- Feature-Sliced Design строго: `app/`, `processes/`, `pages/`, `widgets/`, `features/`, `entities/`, `shared/`
- TanStack Query для серверного состояния
- Zustand для локального
- React Native Reanimated + Skia для графиков (CAPM/CML/SML визуализация)
- WebSocket-клиент для live-котировок
- **Дизайн-система переносится из `CURS Portfolio Tracker.html` 1-в-1:** все CSS-переменные → токены в `shared/config/theme`, все компоненты HTML → RN-компоненты в `shared/ui` с теми же именами и пропсами

## Структура монорепо

```
.
├── design/
│   └── CURS Portfolio Tracker.html   # копия эталонного дизайна
├── apps/
│   ├── api/                  # FastAPI
│   ├── workers/              # Async polling workers
│   └── mobile/               # React Native + FSD
├── packages/
│   ├── shared-types/         # OpenAPI -> TS типы (генерация)
│   └── finance-core/         # Python lib: CAPM/Black-Scholes/бета
├── infra/
│   ├── docker-compose.yml
│   ├── docker-compose.prod.yml
│   ├── traefik/
│   │   ├── traefik.yml
│   │   └── dynamic/
│   └── .env.example
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DESIGN_SYSTEM.md      # токены и компоненты из HTML
│   ├── SCREENS_MAP.md        # карта экранов из HTML
│   ├── FINANCE_MODELS.md     # формулы и их вывод
│   └── API.md
├── CURS Portfolio Tracker.html  # оригинал, не трогать
├── PROGRESS.md
└── README.md
```

## Этапы (выполняй последовательно)

### Этап 0. Анализ дизайна и план

- **Прочитать `CURS Portfolio Tracker.html` в корне** — это первый шаг, без него никакой код не пишется
- Извлечь дизайн-токены → `docs/DESIGN_SYSTEM.md`
- Составить карту экранов и компонентов → `docs/SCREENS_MAP.md`
- Составить ER-диаграмму БД (User, Portfolio, Asset, Position, Quote, RiskSnapshot, BenchmarkPortfolio, ModelParams) — исходя из того, что показано на экранах
- Описать контракты API (OpenAPI-first) — **только эндпоинты, которые нужны экранам из дизайна**, никаких «на будущее»
- Записать в `docs/ARCHITECTURE.md`
- **STOP** — показать план, дождаться подтверждения

### Этап 1. Инфраструктура
- Поднять docker-compose с Traefik + Postgres + Redis + пустыми api/workers
- Реализовать условную логику домена в Traefik
- Health-чеки для всех сервисов
- `.env.example` с комментариями

### Этап 2. Бэкенд под дизайн
- Auth (JWT + refresh, без соцсетей на старте)
- CRUD портфелей и позиций
- **Endpoints строго 1-в-1 под экраны из `SCREENS_MAP.md`** — для каждого экрана выписать, какие данные нужны, и сделать ровно эти endpoint'ы
- WebSocket `/ws/quotes` для live-обновлений
- Tortoise модели + Aerich миграции
- Pytest на каждый endpoint

### Этап 3. Интеграция T-Invest и CoinGecko
- Сервис `integrations/tinkoff.py`: OAuth-токен пользователя хранится зашифрованным (Fernet), синк портфеля, котировки, история сделок
- Сервис `integrations/coingecko.py`: котировки крипты, исторические данные для расчёта беты, market cap, топ-индексы
- Воркеры опрашивают каждые 10-15 сек, респектят rate limits, при 429 — экспоненциальный backoff
- Кэш в Redis с TTL

### Этап 4. Фронт под дизайн

- Поднять Expo проект с FSD-структурой
- **Перенести дизайн-систему из `CURS Portfolio Tracker.html` в `shared/ui` и `shared/config/theme`** — токены, компоненты, состояния
- Реализовать **все экраны из `SCREENS_MAP.md` 1-в-1** с HTML-эталоном: вёрстка, цвета, типографика, отступы, поведение
- Подключить экраны к API
- WebSocket для live-цен
- Если в дизайне есть тёмная/светлая тема — обе

**Критерий приёмки этапа:** скриншоты экранов мобилки визуально совпадают с соответствующими секциями HTML-дизайна (с поправкой на адаптацию web → mobile).

### Этап 5. Риск-менеджмент (главная фича)

Реализовать в `packages/finance-core` (Python), формулы продублировать в `docs/FINANCE_MODELS.md`. **Все визуализации (графики, таблицы, индикаторы) встраивать в существующие экраны дизайна или в новые экраны, оформленные в той же дизайн-системе из HTML.**

**5.1. Бета актива к рынку**
- β = Cov(R_asset, R_market) / Var(R_market)
- Рынок: для российских — IMOEX, для US — S&P 500, для крипты — TOTAL market cap или BTC (выбор бенчмарка пользователю)
- Окно: 90 дней дневных доходностей по умолчанию, конфигурируемо
- Endpoint: `GET /portfolios/{id}/risk/beta`

**5.2. Стресс-тест портфеля**
- Сценарий: «рынок упал на X%» → ожидаемое падение портфеля = Σ(weight_i × β_i × X)
- Дополнительно: исторический VaR (95%, 99%), параметрический VaR
- Endpoint: `POST /portfolios/{id}/risk/stress` с параметром `market_shock`

**5.3. CAPM**
- E(R_i) = R_f + β_i × (E(R_m) − R_f)
- R_f — ключевая ставка ЦБ (для рублёвых) / US Treasury 10Y (для долларовых), тянуть автоматически
- Endpoint: `GET /assets/{id}/capm`

**5.4. CML (Capital Market Line)**
- График в координатах (σ, E(R))
- Возвращать точки для отрисовки + позицию портфеля пользователя относительно линии
- Endpoint: `GET /portfolios/{id}/risk/cml`

**5.5. SML (Security Market Line)**
- График в координатах (β, E(R))
- Каждый актив портфеля — точка, видна недо/переоценённость
- Endpoint: `GET /portfolios/{id}/risk/sml`

**5.6. Парные соотношения активов**
- Для каждой пары (i, j) регрессия: R_i = α + β_ij × R_j + γ × R_market + ε
- Вернуть матрицу: коэффициенты, R², корреляция, ко-волатильность
- Подсветить «лучшие» пары — низкая корреляция при высокой совместной доходности (Sharpe пары)
- Endpoint: `GET /portfolios/{id}/risk/pairs`

**5.7. Black-Scholes**
- Калькулятор цены европейских опционов: C = S·N(d1) − K·e^(−rT)·N(d2)
- Греки: Delta, Gamma, Vega, Theta, Rho
- Implied volatility через метод Брента
- UI: отдельный экран-калькулятор в стиле дизайна + если у пользователя в Т-Инвест есть опционы — автоматический анализ
- Endpoint: `POST /tools/black-scholes`

**5.8. Сравнение с лучшими портфелями рынка**
- Топ-стратегии автоследования из Т-Инвест (или курируемый список, если API не отдаёт)
- Топ крипто-индексы из CoinGecko (DeFi index, top-10 by mcap)
- Метрики: Sharpe, Sortino, max drawdown, alpha (Дженсена), tracking error
- UI: экран «Бенчмарки» в стиле дизайна, наложение своего портфеля на любой бенчмарк
- Endpoint: `GET /benchmarks`, `GET /portfolios/{id}/compare?benchmark_id=...`

### Этап 6. Тесты и полировка
- Юнит-тесты на все финансовые формулы (сверка с примерами из учебников)
- Интеграционные тесты на API
- E2E на ключевые флоу мобилки (Detox или Maestro)
- Визуальное сравнение ключевых экранов с HTML-эталоном
- Прогон линтеров: ruff, mypy, eslint, prettier
- Обновить `README.md` с инструкцией запуска

## Правила работы

1. **Дизайн — закон.** Не добавляй экранов и компонентов, которых нет в `CURS Portfolio Tracker.html`. Не убирай те, что есть. Если что-то в HTML неоднозначно или отсутствует для фичи риск-менеджмента — задай вопрос списком, не выдумывай.
2. **Финансовые формулы — с источником.** В docstring указывай учебник/статью.
3. **Все цифры с фронта — не верь.** Валидация на бэке через Pydantic.
4. **Секреты — только через `.env`**, никогда в коде.
5. **После каждого этапа** — апдейт `PROGRESS.md` с чек-листом и краткое демо (curl/screenshot).
6. **Если упёрся в неясность** — конкретный вопрос, не угадывай.
7. **Коммиты** — Conventional Commits, по одному этапу = одна PR-able пачка.

## Что отдать в финале

- Запускаемый `docker-compose up` (с пустым `.env` → localhost; с `DOMAIN=...` → прод)
- Сборка мобилки через `expo build` / EAS
- Полная документация в `docs/`
- Постман-коллекция или Bruno workspace
- Скриншоты мобилки рядом со скриншотами HTML-эталона для верификации

## Старт

Начни с **Этапа 0**:
1. Прочитай `CURS Portfolio Tracker.html` в корне проекта
2. Запроси у меня токены T-Invest/CoinGecko для дев-окружения
3. Выдай `DESIGN_SYSTEM.md`, `SCREENS_MAP.md`, ER-диаграмму и список endpoint'ов
4. Жди подтверждения перед Этапом 1
