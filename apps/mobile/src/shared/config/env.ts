import Constants from "expo-constants";

type Extra = { apiBaseUrl?: string; wsBaseUrl?: string };

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

/**
 * Базовые URL бэкенда.
 * Приоритет: EXPO_PUBLIC_* env → app.json extra → дефолт.
 * WS по умолчанию выводится из API-URL заменой http→ws (чтобы порт/хост совпадали).
 * Для Android-эмулятора задай EXPO_PUBLIC_API_URL=http://10.0.2.2:<port>.
 */
function strip(url: string): string {
  return url.replace(/\/$/, "");
}

export const API_BASE_URL = strip(
  process.env.EXPO_PUBLIC_API_URL || extra.apiBaseUrl || "http://localhost:8000",
);

export const WS_BASE_URL = strip(
  process.env.EXPO_PUBLIC_WS_URL ||
    extra.wsBaseUrl ||
    API_BASE_URL.replace(/^http/, "ws"),
);
