/**
 * Responsive: единый источник правды о текущем layout-режиме.
 *  - `desktop` (≥1200px): полный десктоп-layout 1-в-1 с styles.css (sidebar + topbar + content).
 *  - `tablet`  (800–1199): десктоп без боковой панели (drawer), таблицы остаются.
 *  - `mobile`  (<800):   bottom-tabs, карточки вместо таблиц, hero сжат.
 *
 * Брейкпойнт совпадает с единственным @media из styles.css (max-width: 1200px для widgets-grid).
 */
import { useWindowDimensions } from "react-native";

import { breakpoints } from "@/shared/config/theme";

export type LayoutMode = "desktop" | "tablet" | "mobile";

export function useLayoutMode(): LayoutMode {
  const { width } = useWindowDimensions();
  if (width >= breakpoints.desktop) return "desktop";
  if (width >= breakpoints.tablet) return "tablet";
  return "mobile";
}

export function useIsDesktop(): boolean {
  return useLayoutMode() === "desktop";
}

export function useIsMobile(): boolean {
  return useLayoutMode() === "mobile";
}

/** Возвращает значение, подходящее текущему layout. Fallback: mobile → tablet → desktop. */
export function byLayout<T>(
  mode: LayoutMode,
  values: { desktop: T; tablet?: T; mobile?: T },
): T {
  if (mode === "mobile") return values.mobile ?? values.tablet ?? values.desktop;
  if (mode === "tablet") return values.tablet ?? values.desktop;
  return values.desktop;
}
