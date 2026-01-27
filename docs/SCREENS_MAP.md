# CURS — Screens Map

Карта экранов и компонентов, извлечённая 1-в-1 из `design/source/*.jsx`. Для каждого экрана: layout, ключевые компоненты, действия пользователя, данные, которые он показывает (т.е. контракт для backend endpoint'ов), и заметки про адаптацию web → mobile.

> Источник истины — `design/CURS Portfolio Tracker.html` (standalone) и расщеплённая копия в `design/source/`. Каждое противоречие между прототипом и `AGENT_PROMPT.md` помечено блоком ⚠️ — оно требует решения пользователя.

---

## 0. Глобальный layout

**App shell** (`app.jsx::App` + `ui.jsx::Sidebar` + `ui.jsx::TopBar`):

```
┌──────────┬──────────────────────────────────────────────┐
│ Sidebar  │ TopBar (crumbs + privacy + + Сделка)        │
│ (232px)  ├──────────────────────────────────────────────┤
│          │ <route content>                              │
│ • Обзор  │                                              │
│ • Аналит │                                              │
│ • Планир │                                              │
│ • Настр  │                                              │
│ —————    │                                              │
│ Портфели │                                              │
│  ▪ Осн   │                                              │
│  ▪ Долго │                                              │
│  ▪ Крипт │                                              │
│ —————    │                                              │
│ + Сделка │                                              │
│ user-card│                                              │
└──────────┴──────────────────────────────────────────────┘
```

- Sidebar — sticky `position: sticky; top: 0; height: 100vh`.
- TopBar — sticky `top: 0; z-index: 5`, breadcrumbs контекстно меняются.
- Tweaks-панель — глобальный overlay (правый нижний угол).
- Privacy-режим — глобальное состояние, размывает `.mask` элементы на всех экранах.

**Глобальные действия:** «+ Сделка» (TopBar + в Sidebar.footer и в кнопках Dashboard/Portfolio) → открывает `AddTxModal`. «+ Актив» доступен только из Portfolio header → `AddAssetModal`.

---

## 1. Обзор (`route='dashboard'`)

**Файл:** `dashboard.jsx::Dashboard` · ширина контента `1180px` · класс `.content.overview`.

### Layout

```
overview-hero
  ▸ eyebrow "ВСЕГО ПО ВСЕМ ПОРТФЕЛЯМ"
  ▸ hero-num (84px) + ₽ + PercentDelta (P&L всего)
  ▸ hero-spark (год назад → сейчас)

class-strip (3 колонки: tradfi / crypto / fiat)
  ▸ dot + label + sum (компакт) + доля % + bar-track

[Section] Портфели  → btn ghost "Перейти в аналитику →"
portfolios-grid (auto-fill, minmax(260px, 1fr))
  ▸ PortfolioCard × N + portfolio-card-add

[Section] Последние сделки  → btn ghost "+ Добавить"
recent-tx
  ▸ TxRow × 6 (initial) + tx-load-more (+6 step) + Свернуть
```

### Данные, которые показывает экран

- Суммарная стоимость всех портфелей в RUB.
- Стоимость 1 год назад (через `agg.series[0].v` — построение начальной точки годовой кривой).
- Год-дельта (`yearPct`) и абсолютная (`totalPl`, `totalPlPct`).
- Разбивка стоимости по 3 классам: tradfi/crypto/fiat (доли %).
- Sparkline аггрегированной стоимости за 365 дней (для `hero-spark`).
- Для каждого портфеля: id, name, color, positions count, total value, 90-дневная sparkline, 90-дневная %-дельта.
- Последние N сделок (полиморфные — типы in/out/tx/div), с pill портфеля.

### Действия

- Клик по `PortfolioCard` → `route=portfolio`, `activePortfolio=p.id`.
- Клик по `portfolio-card-add` → TODO (в дизайне пустой, alert в App).
- «Перейти в аналитику» → `route=analytics`.
- «+ Добавить» (рядом с «Последние сделки») → `AddTxModal` без preset portfolio.

### Endpoint'ы (требуются)

- `GET /dashboard/overview` → `{ total, totalCost, totalPl, totalPlPct, yearPct, series: [{d, v}], byClass: {tradfi, crypto, fiat} }`
- `GET /portfolios` → `[{id, name, color, positionsCount, total, deltaPct90d, series90d}]`
- `GET /transactions?limit=N&offset=M` → список последних сделок (полиморфный — см. § Транзакции).

### Mobile-адаптация

- Hero остаётся, размер цифры пропорционально меньше.
- `class-strip` — 3 колонки → стек или горизонтальный скролл.
- `portfolios-grid` — одна колонка.
- TxRow без изменений.

---

## 2. Портфель (`route='portfolio'`)

**Файл:** `portfolio.jsx::PortfolioScreen` · класс `.content` (max-width 1480).

### Layout

```
page-head
  ▸ color-dot + pill "N позиций" + title (portfolio.name)
  ▸ right: btn "+ Актив", btn primary "+ Сделка"

portfolio-strip (5 элементов в строке)
  ▸ strip-item "Стоимость"  — value (mask) + PercentDelta + "за 3М"
  ▸ vh
  ▸ strip-item "P&L (общий)" — value (up/down)
  ▸ vh
  ▸ strip-item "Стоимость покупок" — value
  ▸ strip-spark (220x48 Sparkline 90d)

[Section "Позиции" / N из M]
  ▸ tabs: Все / Трад. финансы / Крипта / Валюты (с counts)
  ▸ sortable columns: class, value, P&L (↕)

card (no padding) → table.tbl
  ▸ columns: Актив | Класс | Кол-во (+ ср. цена) | Цена | Стоимость (+ share-bar) | P&L
  ▸ row: clickable → onOpenPosition (в коде задел, но onOpenPosition не пробрасывается → деталь не открывается)
  ▸ empty: «В этом классе пока нет позиций» + btn «Добавить»

[Section "Сделки" / N]
  ▸ btn sm "+ Сделка"
card → tx-list (TxRow × max 14)
```

### Данные, которые показывает экран

- Portfolio header: id, name, color, positionsCount.
- Aggregates: total, totalCost, P&L, P&L%, 3M-delta, 3M-sparkline.
- Per-position: assetId, asset.name, asset.sub (subclass), asset.icon, asset.ccy, asset.price (current), asset.class, qty, avgPrice, valueBase, costBase, plPct, share %.
- Transactions filtered by `portfolio.id`, last 14.

### Действия

- Sort by class | value | P&L (toggle desc/asc).
- Filter by class (Все / tradfi / crypto / fiat) — счётчик в табе.
- «+ Актив» → `AddAssetModal` с pre-selected portfolio.
- «+ Сделка» → `AddTxModal` с pre-selected portfolio.
- Клик по строке позиции — задел в коде (`onClick={() => onOpenPosition && onOpenPosition(p)}`), но не подключён.

### Endpoint'ы

- `GET /portfolios/{id}` → `{ id, name, color, total, totalCost, pl, plPct, deltaPct3M, series3M, positions: [...] }`
- `GET /portfolios/{id}/positions?class=all|tradfi|crypto|fiat&sort=value|pl|class&dir=desc|asc` (фильтр+сорт можно делать клиентски, опционально серверно).
- `GET /portfolios/{id}/transactions?limit=14`

### Mobile-адаптация

- Header в одну колонку, действия как круглые ikon-кнопки.
- portfolio-strip → 2×2 grid либо горизонтальный скролл.
- Tabs сделать sticky-scroll горизонтально.
- Таблица позиций → карточный список (сложно адаптировать таблицу на мобилку напрямую).

---

## 3. Аналитика (`route='analytics'`)

**Файл:** `analytics.jsx::AnalyticsScreen` · класс `.content.wide`.

### Layout

```
page-head
  ▸ title "Аналитика"
  ▸ sub "{portfolio.name} · N виджет/виджета/виджетов"
  ▸ right:
      • select portfolio
      • RangeTabs (1Н/1М/3М/1Г/Всё)
      • btn "Редактировать" / primary "Готово"
      • btn "+ Виджет"

widgets-grid (4 col, gap 18px)
  ▸ widget × N (с data-size: xs/sm/md/lg/full)
  ▸ widget-controls (только в edit): ‹ › × (move/delete)
  ▸ если edit && !widgets — нет; widget-add как "Добавить виджет"

edit-bar (sticky bottom-18, только в edit)

WidgetGallery (modal, ширина 780):
  ▸ tabs: Все / Официальные / Сообщество
  ▸ gallery-grid (2 col):
      gallery-card: glyph + title + sub + size + author/installs + btn Добавить/Убрать
  ▸ footer mini "N установлено · M доступно"
```

### Виджеты (полный реестр)

| id | size | категория | что показывает |
|---|---|---|---|
| `kpi-value` | xs | официальный | Стоимость портфеля + Δ за период |
| `kpi-pl` | xs | официальный | P&L всего + Δ% |
| `kpi-sharpe` | xs | официальный | Sharpe Ratio (R−7%)/σ |
| `kpi-maxdd` | xs | официальный | Max Drawdown за период |
| `kpi-cagr` | xs | официальный | CAGR (среднегодовая) |
| `kpi-vol` | xs | @quant_ru / 1.2k | Годовая волатильность |
| `kpi-calmar` | xs | @riskmodel / 480 | Calmar Ratio = CAGR / |MaxDD| |
| `equity` | full | официальный | Equity curve портфеля + IMOEX-прокси, hover-tooltip |
| `structure` | md | официальный | Treemap топ-12 позиций по доле |
| `classes` | md | официальный | Donut + список по 3 классам |
| `drawdown` | full | официальный | Просадка от пика, area chart |
| `frontier` | lg | @markowitz_ru / 3.2k | Эффективная граница: 600 random portfolios + frontier + current/optimal/minvar |
| `montecarlo` | lg | @quants / 2.7k | Monte Carlo fan: 300 paths, percentiles, horizon switcher 6/12/24/36м |
| `correlation` | md | @diversify / 1.8k | Heatmap NxN корреляций (без fiat) |
| `corr-pairs` | md | @diversify / 910 | Топ-3 самые связанные + топ-3 диверсификаторы |
| `monthly` | full | @returns_ru / 650 | Heatmap месячных доходностей: годы × 12 месяцев |

Дефолт: `[kpi-value, kpi-pl, kpi-sharpe, kpi-maxdd, equity, structure, classes, drawdown]`.

### Данные, которые нужны

- Per-portfolio metrics: `{vol, sharpe, annRet, maxDD, calmar}` (calmar считается на клиенте из annRet/maxDD).
- Portfolio series (равномерная дневная) для слайсинга по range.
- Benchmark series (IMOEX-прокси) для equity-виджета. **В дизайне используется ряд SBER со scale-фактором 0.94 как заглушка** — для прода надо настоящий IMOEX или другой бенчмарк.
- Asset returns для корреляций (`CURS_DATA.corrMatrix`).
- Asset `mu, sigma` для frontier (Markowitz с фиксированной кросс-корреляцией 0.3 — в дизайне симуляция).
- Asset `mu, sigma` или portfolio-level статистика для Monte Carlo.

### Действия

- Edit on/off.
- Add widget (через Gallery) / remove (через × в edit).
- Move widget left/right (rearrange).
- Reset layout to default.
- Change range (1Н/1М/3М/1Г/Всё).
- Switch portfolio.
- Persist layout → `localStorage.curs.analytics.widgets`.

### Endpoint'ы

- `GET /portfolios/{id}/metrics?range=1Н|1М|3М|1Г|Всё` → `{vol, sharpe, annRet, maxDD, cagr, calmar}`
- `GET /portfolios/{id}/series?range=...` → массив `{d, v}`
- `GET /portfolios/{id}/structure` → treemap items
- `GET /portfolios/{id}/drawdown?range=...`
- `GET /portfolios/{id}/correlation` → `{labels: [], matrix: [[]]}`
- `GET /portfolios/{id}/frontier` → `{cloud: [{risk, ret}], frontier: [...], current, optimal, minvar}` *(Markowitz — пересекается с Stage 5.4 CML)*
- `POST /portfolios/{id}/montecarlo` body `{horizon, simulations}` → `{paths, percentiles, startValue, target}`
- `GET /portfolios/{id}/monthly-returns` → `[{y, m, ret}]`
- `GET /benchmarks/imoex/series?range=...` (для overlay в equity-виджете)

### Mobile-адаптация

- Сетка 4 col → 1 col (mobile.css).
- Виджеты `full/lg/md` все становятся `full`.
- RangeTabs остаются горизонтально.

---

## 4. Планировщик (`route='calc'`)

**Файл:** `calc.jsx::CalcScreen`.

### Layout

```
page-head
  ▸ title "Планировщик"
  ▸ sub: "Запланируйте..." | "N сделок в плане"
  ▸ right: btn "Очистить", btn primary "Записать все" (если N>0)

calc-hero (grid 1.4fr | 1fr)
  ▸ left: eyebrow + calc-num (64px up/down/0) + ₽ + hint
  ▸ right (3 col on surface-2):
      CalcStat "Покупки"  + sum + count
      CalcStat "Продажи"  + sum + count
      CalcStat "Заработок с продаж" + sum + sub

grid 1.7fr | 1fr (top-aligned):
  LEFT col:
    ▸ PlanCard × N | PlanForm (inline edit)
    ▸ PlanForm (для new — без id) | add-plan-btn
    ▸ empty-state (🗓️) если planов нет

  RIGHT col (sticky top 92):
    ▸ FlowBreakdown card — bar in/out per portfolio
    ▸ TypesBreakdown card — счётчик по типам

toast (если есть)
```

### Plan-форма (6 типов)

Тип-пикер карточками (`type-grid` 3-col): `buy / sell / tx / in / out / div`. Каждый тип меняет нижнюю часть формы:

- **buy**: Что покупаем (select tradable) + Кол-во + Цена за ед. (+quick chips −10/текущая/+10) + Платим из (fiat).
- **sell**: Select из holdings (с qty hint) + Кол-во (+chips 25/50/75/Всё) + Цена (+chips текущая/+10/+30/+50) + Деньги на (fiat).
- **tx**: Отдаём (select+qty grouped fiat/tradfi/crypto) + swap-btn + Получаем (то же).
- **in/out**: select fiat + qty.
- **div**: Источник (tradable) + Валюта выплаты (fiat) + Сумма.

Общие поля: Портфель (select), Дата (input date).

PlanPreview снизу: показывает amount/profit/rate в зависимости от типа.

### Действия

- Add plan / Edit plan (inline) / Delete plan / Cancel.
- Quick chips для qty и price (sell, buy).
- Swap from/to (tx).
- Execute single plan → `planToTx` → unshift в `CURS_DATA.TX`, удалить из плана, toast.
- Execute all → confirm → batch unshift, очистить.
- Clear all → confirm.
- Persist plans → `localStorage.curs.calc.plans.v2`.

### Данные, которые показывает экран

- Список planов с локальным стейтом (id, type, portfolioId, date, type-specific поля).
- Holdings агрегация (non-fiat позиции по всем портфелям) — для qty hint в sell и cost basis для profit.
- Current asset prices и rates-to-base для расчётов amounts.
- aggregatePlans → `{buyCost, buyCount, sellProceeds, sellCost, sellCount, sellProfit, inflow, outflow, divInflow, netCashFlow, byPortfolio: {pf: {in, out}}}`.

### Endpoint'ы

Локальный планировщик хранится клиентски, но execute должен идти на бэк:

- `POST /portfolios/{id}/transactions` (batch или single) → создаёт реальные сделки.
- `GET /portfolios/holdings` (aggregated across portfolios) — для qty/cost basis при sell.
- `GET /assets/{id}/quote` (или общий live-feed через WebSocket).

Сам список плановых сделок можно хранить локально (как сейчас) или серверно — это бизнес-решение для пользователя (см. § Open Questions).

### Mobile-адаптация

- Hero stack вертикально.
- Plan-форма full-width с stacked полями.
- Sticky-сайдбар → переезжает вниз под список.

---

## 5. Настройки (`route='settings'`)

**Файл:** `settings.jsx::SettingsScreen` · max-width 880.

### Layout

```
page-head
  ▸ title "Настройки"
  ▸ sub "Безопасность и источники рыночных данных"

SecurityCard (card)
  ▸ header: "Смена пароля" + mini "Минимум 8 символов · буквы и цифры"
  ▸ grid 2col:
      • Текущий пароль (с eye-toggle)
      • (empty)
      • Новый пароль + PwStrength (0..4 bar) + label
      • Подтвердите + match indicator
  ▸ footer: "Последняя смена: 14 марта 2026" + btn primary "Сохранить пароль"

SourcesCard (card)
  ▸ header: "Источники рыночных данных" + mini "API для подгрузки..."
  ▸ Provider × 2 (collapsible):
      MOEX:
        head: mark "MOEX" (#0072CE) + name + class-chip tradfi + pill "бесплатно" + status-dot + btn "Настроить"/"Скрыть"
        body (expanded): grid 2col fields → Endpoint (readonly), Токен (optional)
        hint, btn "Проверить соединение" (testing state), btn "Подключить"/"Отключить"
      CoinGecko:
        same but with API ключ + plan select [Demo/Analyst/Pro/Enterprise]
  ▸ hint: "Для валют курс ЦБ РФ подгружается автоматически"
```

### Данные

- Current password (для проверки на бэке).
- Password strength score (клиентский).
- Provider connections per user (connected: bool, fields: {baseUrl|apiKey, token|plan}).

### Действия

- Изменить пароль (валидация: cur ≥ 6, new ≥ 8, match) → `POST /auth/password`.
- Provider toggle, edit fields, test connection → `POST /providers/{id}/test` или клиентская проверка (для MOEX — публичный ISS).

### Endpoint'ы

- `POST /auth/password` body `{current, new}` → 200 / 401 / 400.
- `GET /providers` → `[{id, connected, fields}]`
- `PUT /providers/{id}` body `{connected, fields}` (поля зашифрованы Fernet).
- `POST /providers/{id}/test` → `{ok, latencyMs, error?}`.

### Mobile-адаптация

- Карточки full-width, поля stacked.
- Provider collapsible iOS-style.

---

## 6. Модалки

### 6.1 AddTxModal (вызывается из TopBar и Sidebar)

**Файл:** `modals.jsx::AddTxModal` · width 560.

```
header: "Новая сделка"
body:
  Field "Тип" → seg-list-4 (2x2):
    [tx] Транзакция · "Покупка/продажа одного за другой"
    [in] Пополнение
    [out] Вывод
    [div] Дивиденд
  grid 2col:
    Field "Портфель" → select
    Field "Дата" → input type=date
  type-specific:
    tx:  TxSwap (Отдаём + swap-btn + Получаем + hint курса)
    in:  TxInOut (fiat select + qty, label "Вносится")
    out: TxInOut (fiat select + qty, label "Снимается")
    div: TxDiv (Источник tradable + Валюта fiat + Сумма)
footer: btn "Отмена" + btn primary "Добавить" (disabled=!canSubmit)
```

Submit пока **на bind'е closing'ом** — реального persist в дизайне нет (модалка просто закрывается). В проде → `POST /portfolios/{id}/transactions`.

### 6.2 AddAssetModal (вызывается из Portfolio header)

**Файл:** `modals.jsx::AddAssetModal` · width 520.

```
header: "Добавить актив" + sub: "В портфель <name>" или "Будет доступен во всех"
body:
  Field "Класс активa" → seg-list (3 cards: tradfi/crypto/fiat)
  grid 2col:
    Тикер (uppercase, max 8)
    Название
  if tradfi:
    Field "Подкласс" → Pills [Акция, Облигация, ETF, Фонд]
  grid 2col:
    if !fiat: Валюта торгов → Pills [RUB, USD, EUR]
    "Курс к ₽" (fiat) | "Текущая цена" (else) → number + suffix
  hint: "Это только запись актива в каталог..."
footer: btn "Отмена" + btn primary "Добавить актив"
```

В проде → `POST /assets`. Поведение: запись в общий каталог, не в портфель.

### 6.3 WidgetGallery (внутри Analytics)

См. § 3 выше. Клиентская — каталог виджетов хардкодом в JS. В прод-варианте — статичный список (виджеты — это JSX-рендеры, не серверные данные), но `installs` и `author` — атрибуты, которые могут быть динамическими, если бэкенд их отдаёт.

---

## 7. Сущности и форматы данных, видимые экранам

Восстановлено из `data.js` (модель прототипа) + наблюдаемые поля во всех JSX.

### Asset

```ts
{
  id: string,                    // "SBER", "BTC", "OFZ26240"
  name: string,                  // "Сбербанк"
  class: "tradfi" | "crypto" | "fiat",
  sub?: "Акция" | "Облигация" | "ETF" | "Фонд",  // только для tradfi
  ccy: "RUB" | "USD" | "EUR" | "CNY" | "AED",    // валюта торгов
  icon: string,                  // CSS-class: "a-sber", "a-btc", ...
  price: number,                 // current spot price (в trading ccy)
  // Симуляционные поля прототипа (для backend — не нужны, считается из реальных рядов):
  mu?: number, sigma?: number, seed?: number, start?: number,
  series?: [{d: Date, v: number}],  // 365-day daily history
}
```

### Portfolio

```ts
{
  id: string,                    // "main", "long", "crypto"
  name: string,
  color: string,                 // "#15140F", hex
  positions: Position[],
  // computed/derived (отдаются бэком):
  series?: [{d, v}],             // value history in BASE (RUB)
  metrics?: {vol, sharpe, annRet, maxDD}
}
```

### Position

```ts
{
  assetId: string,
  qty: number,                   // количество единиц
  avgPrice: number,              // average cost basis в trading ccy (для tradfi/crypto), в self-ccy для fiat
}
// derived (через valueOfPosition):
// { asset, qty, avgPrice, valBase, costBase, pl, plPct, dayPct }
```

### Transaction (полиморфный)

```ts
type TxType = "in" | "out" | "tx" | "div";
interface BaseTx { id, type: TxType, portfolio, d: Date | ISO-string }
interface InOutTx  extends BaseTx { type: "in" | "out", asset: string, qty: number }
interface SwapTx   extends BaseTx { type: "tx",  from: {asset, qty}, to: {asset, qty} }
interface DivTx    extends BaseTx { type: "div", source: string, cashAsset: string, qty: number }
```

### PlanDraft (только клиент)

```ts
{
  id: string | null,
  type: "buy" | "sell" | "tx" | "in" | "out" | "div",
  portfolioId: string,
  date: string,                  // ISO yyyy-mm-dd
  // type-specific (subset):
  assetId, qty, price, cashAsset,
  fromAsset, fromQty, toAsset, toQty,
  asset, source,
}
```

При `executeTransactions(planToTx(p))` план превращается в `Transaction` (`buy`/`sell` → `tx` форма).

### Class metadata

```ts
CLASS_LABEL = { tradfi: "Трад. финансы", crypto: "Крипта", fiat: "Валюта" }
CLASS_COLOR = { tradfi: "#15140F",       crypto: "#EE7544",  fiat: "#86B0A0" }
```

### Base currency

`BASE = "RUB"` зашит в `data.js`. Все aggregated values → в `₽`. `rateToBase(ccy)` — спотовый курс.

### Today

В прототипе `today = new Date('2026-05-22T12:00:00Z')` — захардкожено для воспроизводимости фейк-данных. На проде — `Date.now()`.

---

## 8. Что НЕТ в дизайне, но требуется по `AGENT_PROMPT.md` Stage 5 — ⚠️ открытые вопросы

Эти модели риск-менеджмента требуются по промпту, но их UI **не присутствует** в `CURS Portfolio Tracker.html`:

| Stage 5 item | Есть ли UI в дизайне? | Где близко |
|---|---|---|
| 5.1 Beta к рынку | Нет dedicated виджета, но равноуместно как widget сообщества | можно сделать widget `kpi-beta` или embed в `equity` |
| 5.2 Стресс-тест + VaR | Нет | можно сделать widget или экран |
| 5.3 CAPM | Нет | можно сделать widget |
| 5.4 CML | Есть `frontier` widget (Markowitz), но это не CML — это efficient frontier in (σ, E(R)) | можно расширить или сделать отдельный widget |
| 5.5 SML | Нет | новый widget |
| 5.6 Парные регрессии | Есть `correlation` (heatmap) и `corr-pairs` — но они показывают только ρ, не β_ij/α/R² | расширить `corr-pairs` или новый widget |
| 5.7 Black-Scholes | Нет (нет калькулятора опционов) | новый экран или новый виджет |
| 5.8 Сравнение с бенчмарками | Есть только overlay IMOEX в `equity`, без полного сравнительного экрана | новый экран |

**Правило AGENT_PROMPT:** «Не добавляй экранов и компонентов, которых нет в `CURS Portfolio Tracker.html`. Не убирай те, что есть. Если что-то в HTML неоднозначно или отсутствует для фичи риск-менеджмента — задай вопрос списком».

Соответствующие вопросы выписаны в `PROGRESS.md` → § Open Questions.

---

## 9. Связанные артефакты (за пределами `CURS Portfolio Tracker.html`)

В бандле также присутствуют:

- `design/source/CURS Mobile.html` + `mobile.jsx` + `mobile.css` + `ios-frame.jsx` — мобильная версия в iOS-рамке (single page, 5 tabs снизу: Обзор / Планировщик / + / Аналитика / Настройки). Реализует тот же data model. **Для Stage 4 (RN/Expo) можно использовать как референс адаптации web → mobile.**
- `design/source/CURS Landing.html` + `landing.jsx` + `landing.css` — лендинг проекта с hero, community widgets showcase, submit-modal. **В `AGENT_PROMPT.md` лендинг не упомянут** — открытый вопрос: реализовывать ли?
- `design/source/audit*/`, `design/source/screens/` — PNG-скриншоты для визуальной верификации.
- `design/source/uploads/` — исходная курсовая (`.docx`, `.pdf`).
