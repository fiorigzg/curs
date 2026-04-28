/**
 * Форматтеры — перенос из `design/source/data.js` и `charts.jsx` 1-в-1.
 * Денежные значения — русская локаль, запятая как десятичный разделитель.
 * Текстовые суффиксы/даты локализуются через t()/getLang().
 */
import { getLang, t } from "@/shared/config/i18n";

// ──────────────────────────── Базовая валюта ────────────────────────────
// Бэкенд считает всё в рублях. База — валюта отображения агрегатов (RUB/USD);
// конвертация линейная: vUsd = vRub / rubPerUsd. Курс берётся из котировки
// USD-актива (RUB за 1 USD) и обновляется в RootNavigator.
export type BaseCurrency = "RUB" | "USD";

let baseCcy: BaseCurrency = "RUB";
let rubPerUsd = 90; // дефолт-фолбэк до загрузки котировок

export function setBaseCurrency(c: BaseCurrency): void {
  baseCcy = c;
}
export function getBaseCurrency(): BaseCurrency {
  return baseCcy;
}
export function setRubPerUsd(rate: number): void {
  if (rate > 0) rubPerUsd = rate;
}
/** Символ выбранной базовой валюты. */
export function baseSym(): string {
  return baseCcy === "USD" ? "$" : "₽";
}
/** Перевод RUB → выбранная валюта (для значений, посчитанных на клиенте в ₽).
 *  Значения с бэкенда УЖЕ приходят в базовой валюте (см. ?ccy=) — их не конвертируем. */
export function toBase(vRub: number): number {
  return baseCcy === "USD" ? vRub / rubPerUsd : vRub;
}

// fmtMoney*/fmtUnit принимают значение УЖЕ в базовой валюте (без конвертации):
// бэкенд считает в ?ccy, клиентские ₽-значения оборачивают в toBase() сами.
export function fmtMoneyCompact(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e9) return (v / 1e9).toFixed(2).replace(".", ",") + t(" B", " млрд");
  if (abs >= 1e6) return (v / 1e6).toFixed(1).replace(".", ",") + t(" M", " млн");
  if (abs >= 1e3) return (v / 1e3).toFixed(0) + t("k", "к");
  return v.toFixed(0);
}

/** Полное число (без k/M-сокращения), разряды через пробел. Для сумм в таблицах. */
export function fmtMoney(v: number, decimals = 0): string {
  return v.toLocaleString("ru-RU", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Цена/средняя за единицу: полное число с адаптивной точностью (мелкие — подробнее). */
export function fmtUnit(v: number): string {
  const abs = Math.abs(v);
  const decimals = abs >= 1000 ? 0 : abs >= 1 ? 2 : abs > 0 ? 6 : 0;
  return v.toLocaleString("ru-RU", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function fmtRUB(v: number, opts: { sign?: boolean; decimals?: number } = {}): string {
  const { sign = false, decimals = 0 } = opts;
  const str = v.toLocaleString("ru-RU", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return (sign && v > 0 ? "+" : "") + str + " ₽";
}

export function fmtCcy(
  v: number,
  ccy: string,
  opts: { sign?: boolean; decimals?: number } = {},
): string {
  if (ccy === "RUB") return fmtRUB(v, opts);
  const { sign = false, decimals = 2 } = opts;
  const sym = ({ USD: "$", EUR: "€" } as Record<string, string>)[ccy] || "";
  const num = v.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return (sign && v > 0 ? "+" : "") + sym + num;
}

export function fmtQty(q: number, decimals?: number): string {
  if (decimals != null) {
    return q.toLocaleString("ru-RU", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }
  if (Math.abs(q) >= 1) return q.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
  return q.toLocaleString("ru-RU", { maximumFractionDigits: 6 });
}

export function fmtPct(v: number, opts: { sign?: boolean; decimals?: number } = {}): string {
  const { sign = true, decimals = 2 } = opts;
  const x = (v * 100).toFixed(decimals).replace(".", ",");
  return (sign && v > 0 ? "+" : "") + x + "%";
}

const MONTHS_RU = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function fmtDateShort(d: string | Date): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  const now = new Date();
  const diffDays = Math.round((now.getTime() - dt.getTime()) / 86400000);
  if (diffDays === 0) return t("today", "сегодня");
  if (diffDays === 1) return t("yesterday", "вчера");
  if (diffDays > 1 && diffDays < 7) return t(`${diffDays}d ago`, `${diffDays} дн назад`);
  const months = getLang() === "ru" ? MONTHS_RU : MONTHS_EN;
  // Год добавляем, если он отличается от текущего (для прошлых лет не угадаешь).
  const year = dt.getFullYear() !== now.getFullYear() ? ` ${dt.getFullYear()}` : "";
  return `${dt.getDate()} ${months[dt.getMonth()]}${year}`;
}

/** Локализованная подпись диапазона (ключи Range остаются кириллическими). */
export function rangeLabel(r: string): string {
  switch (r) {
    case "1Н":
      return t("1W", "1Н");
    case "1М":
      return t("1M", "1М");
    case "3М":
      return t("3M", "3М");
    case "1Г":
      return t("1Y", "1Г");
    case "Всё":
      return t("All", "Всё");
    default:
      return r;
  }
}

/** Множественное число для слова «сделка/trade» (планы). */
export function pluralPlans(n: number): string {
  if (getLang() === "en") return n === 1 ? "trade" : "trades";
  if (n % 10 === 1 && n % 100 !== 11) return "сделка";
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return "сделки";
  return "сделок";
}
