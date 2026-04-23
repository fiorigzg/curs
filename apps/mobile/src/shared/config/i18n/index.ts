/**
 * Минималистичная локализация без словаря-ключей.
 *
 * Вместо `t("nav.overview")` + центральный словарь — инлайновый `t(en, ru)`:
 * каждый вызов несёт оба перевода рядом с местом использования. Это убирает
 * необходимость синхронизировать ключи между файлами и делает перевод
 * самодокументируемым.
 *
 * Язык по умолчанию — English. Текущий язык хранится в модульной переменной;
 * на смену языка дерево перемонтируется (см. settings store + RootNavigator),
 * поэтому отдельная подписка компонентам не нужна — `t()` читает актуальное
 * значение на каждом рендере.
 */
export type Lang = "en" | "ru";

let currentLang: Lang = "en";

export function setI18nLang(lang: Lang): void {
  currentLang = lang;
}

export function getLang(): Lang {
  return currentLang;
}

export function t(en: string, ru: string): string {
  return currentLang === "ru" ? ru : en;
}
