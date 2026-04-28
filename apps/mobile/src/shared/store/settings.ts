/**
 * Пользовательские настройки: тема (dark/light), язык (en/ru), базовая валюта (RUB/USD).
 * Значения по умолчанию: dark + English + RUB.
 *
 * Персист — через secure-storage (localStorage на web). При смене значения
 * сразу применяем палитру/язык/валюту и сохраняем; дерево перемонтируется по
 * ключу в RootNavigator (`${theme}:${lang}:${baseCurrency}`), поэтому все
 * компоненты подхватывают новые colors.*, t() и базовую валюту без подписки.
 */
import { create } from "zustand";

import { applyThemeColors, type ThemeMode } from "@/shared/config/theme";
import { setI18nLang, type Lang } from "@/shared/config/i18n";
import { setBaseCurrency as applyBaseCurrency, type BaseCurrency } from "@/shared/lib/format";

import { getItem, setItem } from "./secure-storage";

const THEME_KEY = "curs.theme";
const LANG_KEY = "curs.lang";
const CCY_KEY = "curs.baseCurrency";

interface SettingsState {
  theme: ThemeMode;
  lang: Lang;
  baseCurrency: BaseCurrency;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setTheme: (theme: ThemeMode) => void;
  setLang: (lang: Lang) => void;
  setBaseCurrency: (ccy: BaseCurrency) => void;
}

export const useSettings = create<SettingsState>((set) => ({
  theme: "dark",
  lang: "en",
  baseCurrency: "RUB",
  hydrated: false,

  hydrate: async () => {
    const [th, lg, cc] = await Promise.all([getItem(THEME_KEY), getItem(LANG_KEY), getItem(CCY_KEY)]);
    const theme: ThemeMode = th === "light" ? "light" : "dark";
    const lang: Lang = lg === "ru" ? "ru" : "en";
    const baseCurrency: BaseCurrency = cc === "USD" ? "USD" : "RUB";
    applyThemeColors(theme);
    setI18nLang(lang);
    applyBaseCurrency(baseCurrency);
    set({ theme, lang, baseCurrency, hydrated: true });
  },

  setTheme: (theme) => {
    applyThemeColors(theme);
    void setItem(THEME_KEY, theme);
    set({ theme });
  },

  setLang: (lang) => {
    setI18nLang(lang);
    void setItem(LANG_KEY, lang);
    set({ lang });
  },

  setBaseCurrency: (baseCurrency) => {
    applyBaseCurrency(baseCurrency);
    void setItem(CCY_KEY, baseCurrency);
    set({ baseCurrency });
  },
}));
