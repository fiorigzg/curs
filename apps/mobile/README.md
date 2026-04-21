# CURS Mobile

React Native (Expo SDK 52) приложение CURS Portfolio Tracker. Строгая Feature-Sliced Design, дизайн-система перенесена 1-в-1 из `design/source/mobile.*`.

> Пакетный менеджер — **yarn** (не pnpm: Expo/Metro конфликтуют с pnpm-симлинками).

## Стек

- Expo SDK 52 / React Native 0.76 / React 18
- React Navigation 7 (bottom-tabs + native-stack)
- TanStack Query (серверное состояние) + Zustand (auth)
- @shopify/react-native-skia (графики: Sparkline, LineArea, Donut)
- expo-secure-store (JWT токены)

## Запуск

```bash
cd apps/mobile
yarn install
yarn start        # Metro + QR
# yarn ios / yarn android — на симуляторе/устройстве
```

API по умолчанию — `http://localhost:8000` (см. `app.json → extra.apiBaseUrl`).
Для физического устройства/Android-эмулятора задай адрес хоста:

```bash
EXPO_PUBLIC_API_URL=http://192.168.x.x:8000 yarn start
```

Бэкенд должен быть поднят (`docker compose ... up`), создан пользователь
(`docker compose exec api python -m curs_api.cli users create ...`) и
засеян каталог (`python -m curs_api.seed`).

## FSD-структура

```
src/
├── app/            # провайдеры + навигация (root, tabs, stacks)
├── pages/          # экраны: login, overview, portfolio, analytics, calc, settings
├── widgets/        # ClassStrip, PortfolioRow
├── features/       # add-tx, add-plan (bottom-sheets)
├── entities/       # transaction (TxRow + meta)
└── shared/
    ├── config/     # theme (токены), env
    ├── ui/         # примитивы + charts (Skia)
    ├── api/        # client (fetch+refresh), hooks (TanStack), types
    ├── store/      # zustand auth
    ├── ws/         # WebSocket live-котировки
    └── lib/        # форматтеры (₽, %, даты)
```

## Соответствие экранов

| Экран | Источник дизайна | API |
|---|---|---|
| Login | (новый, decision C) | `POST /auth/login` |
| Обзор | `mobile.jsx` HomeScreen | `/dashboard/overview`, `/portfolios`, `/transactions` |
| Портфель | `mobile.jsx` PortfolioScreen | `/portfolios/{id}`, `/transactions` |
| Аналитика | `mobile.jsx` AnalyticsScreen | `/portfolios/{id}/{metrics,series,structure}` |
| Планировщик | `mobile.jsx` PlanScreen | `/users/me/plans/*` |
| Настройки | `mobile.jsx` SettingsScreen | `/users/me/providers/*`, `/auth/password` |
