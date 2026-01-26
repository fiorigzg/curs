# CURS — Design System

Извлечено из `design/source/styles.css` (1405 строк), `design/source/ui.jsx`, `data.js` и из тематических подключений в HTML-шелле. Тема одна — **светлая** («warm fintech cream»). Тёмные поверхности (`.card.dark`, hero, edit-bar, toast, side-panel header) — точечные акценты, а не альтернативная тема.

> Источник: `design/source/*` (расщеплённая копия `design/CURS Portfolio Tracker.html`, оригинал в корне). Не редактировать оригинал.

---

## 1. Шрифты

Загружаются с Google Fonts в `<head>` HTML-шелла.

| Стек | CSS var | Использование |
|---|---|---|
| `"Geist", "Inter", system-ui, sans-serif` | `--sans` | Базовый текст, заголовки, числа в hero |
| `"Geist Mono", "JetBrains Mono", ui-monospace, monospace` | `--mono` | Деньги, тикеры, проценты, P&L, kbd, статусные точки. `.mono { letter-spacing: -0.02em; font-feature-settings: "tnum", "zero" }` |
| `"Instrument Serif", "Times New Roman", serif` | `--serif` | Только аннотации `.annot { font-style: italic }` и em-цитаты на лендинге |

Базовый body: `font-size: 14px; line-height: 1.45; letter-spacing: -0.005em; font-feature-settings: "ss01","cv11"; -webkit-font-smoothing: antialiased`.

Tabular-nums добавлен через `.tnum { font-variant-numeric: tabular-nums }` — обязательно для всех колонок таблиц с цифрами и для денежных значений в hero.

### Типографическая шкала (фактическая)

| Роль | Размер | Вес | Letter-spacing | Где |
|---|---|---|---|---|
| Hero-цифра обзора | 84px | 500 | -0.04em | `.hero-num` |
| Hero-цифра планировщика | 64px | 500 | -0.04em | `.calc-num` |
| Hero на dashboard.dark | 64px | 500 | -0.04em | `.hero h1` |
| Title страницы | 28px | 600 | -0.025em | `.page-head .title` |
| Metric value `huge` | 48px | 500 | -0.03em | `.metric .value.huge` |
| Metric value | 28px | 600 | -0.025em | `.metric .value` |
| Modal title | 18px | 600 | -0.015em | `.modal-title` |
| Section title `lg` | 16px | 600 | — | `.section-title.lg` |
| Brand name | 16px | 600 | -0.02em | `.sidebar .brand .name` |
| Body | 14px | 400 | -0.005em | базовый |
| Button label | 13px | 500 | — | `.btn` |
| Table cell | 13px | 400 | — | `.tbl td` |
| Table header | 11px | 500 | 0.04em uppercase | `.tbl th` |
| Field label | 11px | 500 | 0.06em uppercase | `.field-label` |
| Mini | 11px | 400 | — | `.mini` |
| Pill / class-chip | 11px | 500 | — | `.pill`, `.class-chip` |
| KBD | 10px | mono | — | `.search .kbd` |
| Eyebrow | 12px | 400 | 0.08em uppercase | hero-секции |

---

## 2. Цвета (точные значения из `:root`)

### Поверхности — «warm cream»

| Var | Hex | Использование |
|---|---|---|
| `--bg` | `#F6F4EE` | Фон body, фон topbar и sidebar |
| `--surface` | `#FFFFFF` | Карточки, инпуты, header таблицы |
| `--surface-2` | `#FBF9F4` | Hover-фон, modal-body inputs, calc-hero-stats |
| `--surface-3` | `#F0EDE5` | Tabs-фон, tab inactive, surface-3 элементы, .tx-icon swap bg |
| `--inset` | `#EFECE3` | Зарезервирован (не использован прямо) |

### Чернила (текст)

| Var | Hex | Использование |
|---|---|---|
| `--ink` | `#15140F` | Основной текст, бренд-марк, primary button bg, dark cards |
| `--ink-2` | `#4A4842` | Вторичный текст, headings в карточках |
| `--ink-3` | `#807D74` | Muted, mini, breadcrumbs, sub-labels |
| `--ink-4` | `#B5B1A6` | Ультра-muted, табличные arrows, dashed-borders |
| `--hairline` | `#E5E1D6` | Разделитель карточек, табличные `th` |
| `--hairline-2` | `#EFEBE0` | Разделитель строк в таблицах и тx-list |

### Семантика — рост/падение/предупреждение

| Var | Hex | Использование |
|---|---|---|
| `--up` | `#2F7D43` | Положительная дельта, pill.up text, status-dot.on |
| `--up-soft` | `#DCEAD8` | Pill.up bg, up-soft фоновые подложки |
| `--up-ink` | `#1E5A2F` | Pill.up на тёмном фоне |
| `--down` | `#C0392B` | Отрицательная дельта, danger |
| `--down-soft` | `#F4DAD4` | Pill.down bg |
| `--down-ink` | `#862618` | Pill.down text accent |
| `--warn` | `#B58300` | Дивиденды, pill.warn |
| `--warn-soft` | `#F2E6BF` | Pill.warn bg |

### Акценты

| Var | Hex | Использование |
|---|---|---|
| `--accent` | `#15140F` | = `--ink`, primary button |
| `--accent-2` | `#D7E041` | Citron — fokус-акцент на чёрных поверхностях (brand mark, range-tab.active, hero pulse dot, edit-bar.primary). Tweakable. |
| `--accent-3` | `#4F6BED` | Cobalt — гиперссылка/индикатор-стиль |
| `--accent-4` | `#EE7544` | Terracotta — крипта-акцент |

### Палитра категорий (для treemap, donut, asset icons)

`--c1: #2F4858, --c2: #86B0A0, --c3: #D7E041, --c4: #EE7544, --c5: #4F6BED, --c6: #B58300, --c7: #8C5BD7, --c8: #1F8F6F, --c9: #C0392B, --c10: #B5B1A6`

### Asset-icon мапа (`.a-*`)

| Класс | Цвет фона | Цвет текста | Тикеры |
|---|---|---|---|
| `.a-rub` | `#15140F` (ink) | `#D7E041` (citron) | RUB |
| `.a-usd` | `#1F8F6F` | white | USD |
| `.a-eur` | `#4F6BED` | white | EUR |
| `.a-sber` | `#1B8A4F` | white | SBER |
| `.a-yndx` | `#C0392B` | white | YNDX |
| `.a-lkoh` | `#D7E041` | `#15140F` | LKOH |
| `.a-gazp` | `#4F6BED` | white | GAZP |
| `.a-aapl` | `#4A4842` | white | AAPL |
| `.a-nvda` | `#1F8F6F` | white | NVDA |
| `.a-ofz` | `#2F4858` | white | OFZ26240 |
| `.a-vtbr` | `#B58300` | white | VTBR |
| `.a-btc` | `#EE7544` | white | BTC |
| `.a-eth` | `#8C5BD7` | white | ETH |
| `.a-sol` | `#86B0A0` | `#15140F` | SOL |
| `.a-default` | `var(--ink-3)` | white | fallback |

### Класс-цвета (для chips и dots)

```
tradfi → #15140F
crypto → #EE7544
fiat   → #86B0A0
```

### Provider-марки (на странице Настроек)

| `data-prov` | Hex |
|---|---|
| `moex` | `#0072CE` |
| `coingecko` | `#8DC647` (текст ink) |

---

## 3. Геометрия

| Var | Значение |
|---|---|
| `--radius` | 10px (общий) |
| `--radius-lg` | 16px (карточки, hero, side-panel) |
| `--radius-sm` | 6px (range-tabs, type-chip) |
| `--gap` | 14px (cozy) / 10px (compact) |
| `--gap-lg` | 22px |
| `--pad-card` | 22px (cozy) / 16px (compact) |
| `--row-h` | 52px (cozy) / 40px (compact) |

Density-токены — единственный «теmu-like» механизм: переключатель `[data-density="compact"]` на `<html>` пересобирает плотность. Управляется из Tweaks-панели.

Модальный radius: 18px (отдельно от `--radius-lg`).

### Тени (фактический инвентарь)

| Тень | Где |
|---|---|
| `0 1px 2px rgba(0,0,0,.04)` | tab.active |
| `0 2px 6px rgba(0,0,0,.04)` | widget-ctrl |
| `0 8px 30px rgba(0,0,0,.06)` | plan-form (активная) |
| `0 10px 30px rgba(0,0,0,.18)` | chart-tooltip, edit-bar, toast |
| `0 30px 80px rgba(0,0,0,.25)` | modal |
| `-30px 0 60px rgba(0,0,0,.06)` | side-panel |

Прочих shadow-токенов в `:root` нет — это все используемые значения.

---

## 4. Брейкпоинты

Один объявленный брейк:

```css
@media (max-width: 1200px) { .widget[data-size="lg"] { grid-column: span 2; } }
```

HTML-шелл задаёт `meta viewport: width=1440` — десктоп-only, mobile-версия отдельным файлом (`design/source/CURS Mobile.html`).

Сетка приложения: `grid-template-columns: 232px 1fr` (sidebar + main), `.content { max-width: 1480px }`, `.content.overview { max-width: 1180px }`, `.content.wide { max-width: none }`.

---

## 5. Density / Privacy / Tweaks

Состояние на корневом `<html>`:

| Аттрибут | Значения | Эффект |
|---|---|---|
| `data-density` | `cozy` \| `compact` | пересборка `--pad-card`, `--row-h`, `--gap` |
| `data-privacy` | `on` \| `off` | `[data-privacy="on"] .mask { filter: blur(7px); user-select: none }` |

`--accent-2` (citron) меняется через Tweaks-панель: палитра `['#D7E041', '#EE7544', '#4F6BED', '#86B0A0']`. По умолчанию `#D7E041`.

`.mask` — единственный класс приватности. Прикладывается ко всем числовым значениям (деньги, qty в дивиденд-карточках, P&L). Контролируется кнопкой-глазом в `TopBar`.

---

## 6. Состояния

### Кнопки (`.btn`)

| Состояние | Стиль |
|---|---|
| default | `bg: var(--surface), border: 1px solid var(--hairline), color: var(--ink), h: 32px, padding: 0 12px, radius: 8px` |
| hover | `bg: var(--surface-2), border-color: var(--ink-4)` |
| active (pressed) | `transform: translateY(1px)` (0.08s) |
| primary | `bg: var(--ink), color: var(--surface), border: var(--ink)`; hover → `#000` |
| ghost | `bg: none, border-color: transparent`; hover → `bg: var(--surface-3)` |
| sm | h: 26px, padding: 0 8px, fz: 12px |
| icon | width: 32px, padding: 0 |
| disabled | (через `disabled` HTML attr, без отдельного класса) |

### Инпуты (`.inp`)

| Состояние | Стиль |
|---|---|
| default | h: 38px, padding: 0 12px, border: 1px solid var(--hairline), radius: 9px |
| focus | `border-color: var(--ink)` (через `.inp-row:focus-within` для группы) |

### Tabs

`.tab` (внутри `.tabs`): inactive — `color: var(--ink-3)`; hover → `color: var(--ink)`; active — `bg: var(--surface), box-shadow: 0 1px 2px rgba(0,0,0,.04)`.

`.range-tab` (моноширинный, для диапазонов аналитики): active — `bg: var(--ink), color: var(--accent-2)`.

### Pills

`pill`, `pill.up/down/ghost/solid/warn/lg` — варианты с разными `bg/color/border`. Базовая — h: 22px, radius: 999px, fs: 11px.

### Sidebar nav

`.nav-item` — `color: var(--ink-2)`; hover → `bg: var(--surface-3), color: var(--ink)`; active → `bg: var(--ink), color: var(--surface)` (с акцентом citron на иконке и `count`).

### Modal

Анимация входа: backdrop `fadeIn .15s ease`, content `modalIn .18s cubic-bezier(.4,.7,.2,1)` (translateY(8px)→0 + scale(.98)→1).

### Side panel (Position detail)

`.side-panel.open { transform: translateX(0) }` (260ms cubic-bezier(.4,.7,.2,1)). Backdrop `.side-backdrop.open` — `opacity 0→1` 200ms. **Компонент объявлен в CSS, но в текущем JSX не используется** — задел под position-detail.

### Empty / Warning / Loading

- **Empty** — `.empty-state` (40px вертикально, серый текст, иногда иконка-эмодзи). Используется в Calc.
- **Warn (план превышает остаток)** — `.plan-card.warn { border-color: var(--down-soft); background: rgba(192,57,43,.02) }`.
- **Loading** — не объявлено; есть локальный `'pending'` стейт в `Provider.test()` (текст «Проверяю…»).
- **Toast** — `.toast` (правый нижний угол, тёмный фон, fs: 13, анимация `toastIn .2s`).

### Hover на портфельной карточке

`.portfolio-card:hover { border-color: var(--ink) }`, `.portfolio-card:active { transform: translateY(1px) }`.

### Provider connected

`.provider.connected { border-color: var(--ink-4); background: var(--surface-2) }`, `.status-dot.on > span:first-child { background: var(--up); box-shadow: 0 0 0 3px rgba(47,125,67,.18) }`.

---

## 7. Компонентный инвентарь

Все компоненты, фактически зарегистрированные на `window.*` namespaces в исходниках:

### `CURS_UI` (из `ui.jsx`)

| Компонент | Пропсы | Назначение |
|---|---|---|
| `Sidebar` | `route, setRoute, portfolios, activePortfolio, setActivePortfolio, onAdd(kind)` | Левая колонка: бренд, 4 nav-item (Обзор/Аналитика/Планировщик/Настройки), секция «Портфели» с динамическим списком, кнопка «+ Сделка», user-card |
| `TopBar` | `crumbs, privacy, setPrivacy, onAddTx` | Breadcrumbs + privacy toggle (eye/eye_off) + primary «+ Сделка» |
| `AssetIcon` | `asset, size=28` | Цветной квадратик с тикером, цвет через `asset.icon` class |
| `ClassChip` | `cls, small` | Pill с цветной точкой + лейблом класса |
| `RangeTabs` | `value, onChange, options=['1Н','1М','3М','1Г','Всё']` | Моноширинные range tabs |
| `PercentDelta` | `value, abs` | `▲/▼ XX,XX% +Y₽` с up/down цветом |
| `SectionHeader` | `title, sub, right` | Заголовок секции с правым слотом для actions |
| `Modal` | `open, onClose, title, sub, children, footer, width=480` | Modal shell с backdrop, Esc-handler |

Иконки `I` — inline SVG: `home, briefcase, chart, calc, settings, search, plus, arrow_right, close, eye, eye_off, swap, arrow_in, arrow_out, coin`. Все 24x24 viewBox, stroke="currentColor".

### `CURS_PORTFOLIO` (из `portfolio.jsx`)

| Компонент | Назначение |
|---|---|
| `PortfolioScreen` | Экран портфеля: header, strip, positions-таблица с фильтром по классам + сортировкой по value/pl/class, сделки |
| `PositionRow` | Строка в таблице позиций: иконка + тикер + класс-чип + qty + ср.цена + текущая + value + share-bar + P&L |
| `TxRow` | Строка сделки: иконка типа + title + sub + portfolio pill (опц.) + сумма + дата |
| `txMeta(type)` | Метаданные по типу сделки → `{label, icon, color, bg}` |

### `CURS_DASHBOARD` (из `dashboard.jsx`)

| Компонент | Назначение |
|---|---|
| `Dashboard` | Экран обзора: hero-цифра + класс-полоса + portfolios-grid + recent-tx со «Показать ещё» |
| `PortfolioCard` | Карточка портфеля в обзоре: dot + name + positions count + sparkline + total + delta |

### `CURS_ANALYTICS` (из `analytics.jsx`)

| Компонент / структура | Назначение |
|---|---|
| `AnalyticsScreen` | Кастомизируемый дашборд: 4-колоночная сетка виджетов, режим Edit (стрелки + удалить), Widget Gallery modal |
| `Widget` | Обёртка с edit-controls |
| `WidgetGallery` | Modal с табами All/Official/Community, gallery-card |
| `KpiCard` | Универсальная KPI-карточка |
| `WIDGETS` (объект из 14 виджетов) | Реестр виджетов |
| `FrontierWidget`, `MonteCarloWidget`, `MonthlyReturnsWidget` | Тяжёлые виджеты с локальным state |
| `PairRow` | Строка корреляционной пары |

#### Реестр виджетов (`WIDGETS`)

Каждый — `{ title, sub, size: 'xs'|'sm'|'md'|'lg'|'full', official: bool, glyph, color, author?, installs?, render(ctx) }`.

**Официальные (7):** `kpi-value` (xs), `kpi-pl` (xs), `kpi-sharpe` (xs), `kpi-maxdd` (xs), `kpi-cagr` (xs), `equity` (full, линия портфеля vs IMOEX-прокси), `structure` (md, treemap), `classes` (md, donut по классам), `drawdown` (full).

**Сообщество (7):** `kpi-vol` (xs, @quant_ru), `kpi-calmar` (xs, @riskmodel), `frontier` (lg, @markowitz_ru), `montecarlo` (lg, @quants), `correlation` (md, @diversify), `corr-pairs` (md, @diversify), `monthly` (full, @returns_ru).

**Дефолтный layout:** `['kpi-value', 'kpi-pl', 'kpi-sharpe', 'kpi-maxdd', 'equity', 'structure', 'classes', 'drawdown']`. Сохраняется в `localStorage.curs.analytics.widgets`.

### `CURS_CALC` (из `calc.jsx`)

| Компонент | Назначение |
|---|---|
| `CalcScreen` | Планировщик: hero c кэш-флоу, список планов с inline-form, сайдбар (FlowBreakdown + TypesBreakdown), executable планы → реальные `TX` |
| `CalcHero`, `CalcStat` | Hero с цветовой подсветкой net |
| `PlanCard` | Карточка плана + warn для exceed |
| `PlanForm` | Inline-форма с type-picker (6 типов) и type-specific подформами |
| `BuyForm/SellForm/TxForm/InOutForm/DivForm` | Подформы под тип |
| `PlanPreview` | Live-превью внутри формы |
| `FlowBreakdown`, `TypesBreakdown` | Sticky-сайдбар |

Storage: `localStorage.curs.calc.plans.v2`.

### `CURS_SETTINGS` (из `settings.jsx`)

| Компонент | Назначение |
|---|---|
| `SettingsScreen` | Layout: 2 секции вертикально |
| `SecurityCard` | Смена пароля: current + new + confirm + show-toggle + PwStrength bar (0..4) + canSave валидация |
| `PwStrength` | 4-segment индикатор силы |
| `SourcesCard` | Список провайдеров |
| `Provider` | Раскрываемая карточка провайдера с полями, кнопкой проверки, тогглом подключения |

**Провайдеры:** MOEX (Endpoint readonly + опциональный токен) и CoinGecko (API key + plan selector: Demo/Analyst/Pro/Enterprise).

### `CURS_MODALS` (из `modals.jsx`)

| Компонент | Назначение |
|---|---|
| `AddAssetModal` | Класс-пикер (3 сегмент-карточки) + Ticker/Name/Subclass/Currency/Price; запись в каталог, не в портфель |
| `AddTxModal` | Сегмент-карточки типа (4: tx/in/out/div) + Portfolio + Date + type-specific тело |
| `TxInOut`, `TxSwap`, `TxDiv` | Тела по типу |
| `Field`, `Pills`, `AssetQtyRow` | Локальные form primitives |

### `CURS_CHARTS` (из `charts.jsx`)

Чисто SVG, ResizeObserver-based. Все рисуют на raw `<svg>`, без библиотек.

| Чарт | Назначение |
|---|---|
| `LineAreaChart` | Главный equity-curve, опционально `compareSeries` (IMOEX-прокси), hover-tooltip |
| `Sparkline` | Мини-линия в карточках и navigation |
| `Treemap` | Структура портфеля (12 топ-позиций) |
| `Donut` | Распределение по классам |
| `Heatmap` | Матрица корреляций (NxN) |
| `FrontierChart` | Облако портфелей + frontier + current/optimal/minvar маркеры |
| `MonteCarloFan` | Перцентильные веера (p10/p25/p50/p75/p90) |
| `DrawdownChart` | Просадка от пика |
| `fmtMoneyCompact`, `fmtDateRu` | Утилиты форматирования |

### `TweaksPanel` (из `tweaks-panel.jsx`)

Глобальный overlay в правом нижнем углу: `density` (radio cozy/compact), `accent` (цветовой свотч из 4-х) и `privacy` (toggle). Дефолты в `TWEAK_DEFAULTS`. Хранение через `useTweaks` (localStorage).

---

## 8. Навигационная модель

Один уровень роутинга на стейте в `App` (`route` ∈ `dashboard|portfolio|analytics|calc|settings`). Sub-state — `activePortfolio` (для route=`portfolio` и `analytics`).

Иерархия (по порядку в сайдбаре):

1. **Обзор** (`dashboard`) — `home` icon
2. **Аналитика** (`analytics`) — `chart` icon
3. **Планировщик** (`calc`) — `calc` icon
4. **Настройки** (`settings`) — `settings` icon
5. **Портфели** (секция со списком, `portfolio` route с `activePortfolio`) — каждый портфель: dot, name, value (mask) в моно

Breadcrumbs в `TopBar` строятся в `App.crumbs`:
- `dashboard` → `[CURS, Обзор]`
- `portfolio` → `[CURS, Портфели, <name>]`
- `analytics` → `[CURS, Аналитика, <name>]`
- `calc` → `[CURS, Планировщик]`
- `settings` → `[CURS, Настройки]`

Глобальные действия в `TopBar`: privacy toggle + «+ Сделка» (открывает `AddTxModal`).

Modals — overlay-уровень: `AddTxModal`, `AddAssetModal`, `WidgetGallery` (внутри Analytics).

Side-drawer для деталей позиции CSS-объявлен (`.side-panel`), но **не подключён в JSX** — задел.

---

## 9. Lokальный state и persistence

| Ключ localStorage | Где | Шейп |
|---|---|---|
| `curs.analytics.widgets` | analytics.jsx | `string[]` (массив widget id) |
| `curs.calc.plans.v2` | calc.jsx | `PlanDraft[]` |
| `curs.tweaks` (предполож.) | tweaks-panel.jsx | `{density, privacy, accent}` |

Сделки (`CURS_DATA.TX`) — in-memory; `executeTransactions` в `App` мутирует массив `unshift`'ом. Это полностью моковое поведение фронта — в проде должно идти через бэкенд.

---

## 10. Что НЕ объявлено (риски при переносе)

- Нет токенов **focus-ring** для accessibility (используется `outline: none` на инпутах). При переносе на RN/мобилку — нужно явно решить.
- Нет токенов для **disabled** состояний кнопок (используется HTML `disabled`, opacity не задана).
- Нет токенов **loading skeleton**; нет shimmer/spinner.
- Нет токенов **error-state** в инпутах. Валидация в формах — `disabled` кнопки submit.
- Нет тёмной темы как режима — только локальные тёмные акценты.
- Нет responsive-сетки (mobile отдельным файлом).
- В CSS объявлен `.side-panel` но в JSX position-detail не реализован.
- Custom-scrollbar только для WebKit.
