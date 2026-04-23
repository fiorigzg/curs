/**
 * Дизайн-токены CURS — извлечены 1-в-1 из `design/source/styles.css` (десктоп-эталон).
 *
 * Две темы: dark (по умолчанию) и light ("warm fintech cream", исходная).
 * `colors` — *мутируемый* объект: на смену темы его свойства перезаписываются
 * через applyThemeColors(), а дерево перемонтируется по ключу (RootNavigator),
 * поэтому ~280 обращений к colors.* по всему коду не нужно переписывать на hook.
 */
import { t } from "@/shared/config/i18n";

export type ThemeMode = "dark" | "light";

// Категорийная палитра (treemap / charts / иконки) — фиксированная, от темы не зависит.
const category = {
  c1: "#2F4858",
  c2: "#86B0A0",
  c3: "#D7E041",
  c4: "#EE7544",
  c5: "#4F6BED",
  c6: "#B58300",
  c7: "#8C5BD7",
  c8: "#1F8F6F",
  c9: "#C0392B",
  c10: "#B5B1A6",
  // Акценты — общие для обеих тем (кроме accent2, он зависит от темы)
  accent3: "#4F6BED", // cobalt
  accent4: "#EE7544", // terracotta
  white: "#FFFFFF",
} as const;

// ──────────────────────────── Light (warm cream) ────────────────────────────
const lightColors = {
  bg: "#F6F4EE",
  surface: "#FFFFFF",
  surface2: "#FBF9F4",
  surface3: "#F0EDE5",
  inset: "#EFECE3",

  ink: "#15140F",
  ink2: "#4A4842",
  ink3: "#807D74",
  ink4: "#B5B1A6",
  hairline: "#E5E1D6",
  hairline2: "#EFEBE0",

  up: "#2F7D43",
  upSoft: "#DCEAD8",
  upInk: "#1E5A2F",
  down: "#C0392B",
  downSoft: "#F4DAD4",
  downInk: "#862618",
  warn: "#B58300",
  warnSoft: "#F2E6BF",

  accent: "#15140F", // primary = ink
  accent2: "#D7E041", // citron
  ...category,

  // black используется только для hover primary-кнопки (чуть темнее ink)
  black: "#000000",
  modalBackdrop: "rgba(15, 14, 10, 0.32)",
};

// ──────────────────────────── Dark (warm charcoal) ────────────────────────────
const darkColors: typeof lightColors = {
  bg: "#14130F",
  surface: "#1C1B16",
  surface2: "#23211B",
  surface3: "#2C2A23",
  inset: "#26241E",

  ink: "#F6F4EE",
  ink2: "#CFCBC1",
  ink3: "#928E84",
  ink4: "#615D54",
  hairline: "#302D27",
  hairline2: "#28251F",

  up: "#4CB568",
  upSoft: "#1C3322",
  upInk: "#86D89B",
  down: "#E15B4C",
  downSoft: "#3A201C",
  downInk: "#F2A99E",
  warn: "#D7A323",
  warnSoft: "#3A3015",

  accent: "#F6F4EE", // primary = ink (cream) → светлая primary-кнопка
  accent2: "#94A026", // citron, приглушённый/тёмный под тёмную тему
  ...category,

  // в dark primary-кнопка кремовая → hover чуть светлее (к белому)
  black: "#FFFFFF",
  modalBackdrop: "rgba(0, 0, 0, 0.55)",
};

const palettes = { dark: darkColors, light: lightColors };

// Мутируемая активная палитра. Инициализируется dark (тема по умолчанию).
export const colors: typeof lightColors = { ...darkColors };

export function applyThemeColors(mode: ThemeMode): void {
  Object.assign(colors, palettes[mode]);
}

// Фиксированная палитра для графиков/категорий (не зависит от темы).
export const chartPalette = [
  "#15140F", category.c1, category.c2, category.c3, category.c4, category.c5,
  category.c6, category.c7, category.c8, category.c9, "#4A4842", category.c10,
];

// Class metadata — 1-в-1 из data.js
export const classColor: Record<string, string> = {
  tradfi: "#15140F",
  crypto: "#EE7544",
  fiat: "#86B0A0",
};

/** Локализованная подпись класса актива. */
export function classLabel(cls: string): string {
  switch (cls) {
    case "tradfi":
      return t("TradFi", "Трад. финансы");
    case "crypto":
      return t("Crypto", "Крипта");
    case "fiat":
      return t("Currency", "Валюта");
    default:
      return cls;
  }
}

// Asset-icon palette (.a-*) из styles.css
export const assetIcon: Record<string, { bg: string; fg: string }> = {
  RUB: { bg: "#15140F", fg: "#D7E041" },
  USD: { bg: "#1F8F6F", fg: "#FFFFFF" },
  EUR: { bg: "#4F6BED", fg: "#FFFFFF" },
  SBER: { bg: "#1B8A4F", fg: "#FFFFFF" },
  YNDX: { bg: "#C0392B", fg: "#FFFFFF" },
  LKOH: { bg: "#D7E041", fg: "#15140F" },
  GAZP: { bg: "#4F6BED", fg: "#FFFFFF" },
  AAPL: { bg: "#4A4842", fg: "#FFFFFF" },
  NVDA: { bg: "#1F8F6F", fg: "#FFFFFF" },
  OFZ26240: { bg: "#2F4858", fg: "#FFFFFF" },
  VTBR: { bg: "#B58300", fg: "#FFFFFF" },
  BTC: { bg: "#EE7544", fg: "#FFFFFF" },
  ETH: { bg: "#8C5BD7", fg: "#FFFFFF" },
  SOL: { bg: "#86B0A0", fg: "#15140F" },
  default: { bg: "#807D74", fg: "#FFFFFF" },
};

// ──────────────────────────── Geometry ────────────────────────────
export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
  modal: 18,
  field: 9,
  button: 8,
} as const;

// Density — cozy / compact (data-density="compact" в эталоне)
export const density = {
  cozy: { padCard: 22, rowH: 52, gap: 14, gapLg: 22 },
  compact: { padCard: 16, rowH: 40, gap: 10, gapLg: 18 },
} as const;

// ──────────────────────────── Layout ────────────────────────────
export const layout = {
  sidebarWidth: 232,
  contentMaxWidth: 1480,
  contentOverviewMaxWidth: 1180,
  topbarPaddingV: 18,
  topbarPaddingH: 28,
  contentPadding: 28,
} as const;

// Breakpoint — единственный объявленный в эталоне.
export const breakpoints = {
  desktop: 1200, // ≥ → полный layout с sidebar
  tablet: 800,
} as const;

// ──────────────────────────── Typography ────────────────────────────
// "Geist" + fallback. На web Metro грузит ttf/woff если подключены;
// на native подключаются через expo-font (опционально, fallback на system).
const FALLBACK_SANS =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
const FALLBACK_MONO =
  '"SF Mono", Menlo, Consolas, "Roboto Mono", monospace';

export const font = {
  sans: `Geist, ${FALLBACK_SANS}`,
  mono: `"Geist Mono", ${FALLBACK_MONO}`,
  serif: `"Instrument Serif", "Times New Roman", serif`,
} as const;

// Размеры — точно по styles.css
export const fontSize = {
  // Body
  body: 14,
  // Mini / labels
  micro: 10,
  mini: 11,
  sub: 12,
  // UI
  buttonSm: 12,
  button: 13,
  pill: 11,
  tab: 12,
  rangeTab: 12,
  // Headings
  brand: 16,
  metric: 28, // .metric .value
  metricHuge: 48, // .metric .value.huge
  sectionTitle: 13,
  sectionTitleLg: 16,
  pageTitle: 28, // .page-head .title
  modalTitle: 18,
  // Hero
  heroNum: 84, // .hero-num — overview
  heroCcy: 36,
  heroDark: 64, // .hero h1 — dark dashboard hero
  calcNum: 64, // .calc-num — planner hero
  // Mobile-сжатые версии тех же ролей
  heroNumMobile: 44,
  pageTitleMobile: 24,
  metricMobile: 22,
} as const;

export const lineHeight = {
  body: 1.45,
  tight: 1.2,
} as const;

export const letterSpacing = {
  base: -0.05, // ~ -0.005em × 10 (RN doesn't accept em)
  metric: -0.7, // -0.025em
  hero: -3.4, // -0.04em
  upper: 0.65, // 0.06em uppercase
  upper04: 0.4,
} as const;

// ──────────────────────────── Shadows ────────────────────────────
export const shadow = {
  tab: {
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  widgetCtrl: {
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  planForm: {
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  chartTooltip: {
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  modal: {
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 80,
    shadowOffset: { width: 0, height: 30 },
    elevation: 16,
  },
  sidePanel: {
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 60,
    shadowOffset: { width: -30, height: 0 },
    elevation: 12,
  },
} as const;

// Несколько legacy-алиасов на старые имена spacing — UI постепенно мигрирует на density.
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;
