import { colors } from "@/shared/config/theme";
import { t } from "@/shared/config/i18n";
import type { PlanType, TxType } from "@/shared/api/types";

// Функции, а не const-объекты: цвета зависят от темы (мутируемый colors),
// поэтому читаем их в момент рендера, а не на импорте модуля.
export function txMeta(type: TxType): { glyph: string; bg: string; color: string } {
  switch (type) {
    case "in":
      return { glyph: "+", bg: colors.upSoft, color: colors.up };
    case "out":
      return { glyph: "−", bg: colors.downSoft, color: colors.down };
    case "tx":
      return { glyph: "⇄", bg: colors.surface3, color: colors.ink };
    case "div":
      return { glyph: "◆", bg: colors.warnSoft, color: colors.warn };
  }
}

export function planMeta(type: PlanType): { icon: string; bg: string; color: string } {
  switch (type) {
    case "buy":
      return { icon: "↑", bg: colors.upSoft, color: colors.up };
    case "sell":
      return { icon: "↓", bg: colors.downSoft, color: colors.down };
    case "tx":
      return { icon: "⇄", bg: colors.surface3, color: colors.ink };
    case "in":
      return { icon: "+", bg: colors.upSoft, color: colors.up };
    case "out":
      return { icon: "−", bg: colors.downSoft, color: colors.down };
    case "div":
      return { icon: "◆", bg: colors.warnSoft, color: colors.warn };
  }
}

/** Локализованная подпись типа сделки. */
export function txTypeLabel(type: TxType): string {
  switch (type) {
    case "in":
      return t("Deposit", "Пополнение");
    case "out":
      return t("Withdrawal", "Вывод");
    case "tx":
      return t("Trade", "Транзакция");
    case "div":
      return t("Dividend", "Дивиденд");
  }
}

/** Локализованная подпись подкласса актива (значение в БД остаётся каноническим). */
export function subclassLabel(v?: string | null): string {
  switch (v) {
    case "Акция":
      return t("Stock", "Акция");
    case "Облигация":
      return t("Bond", "Облигация");
    case "Фонд":
      return t("Fund", "Фонд");
    case "ETF":
      return "ETF";
    default:
      return v ?? "";
  }
}

/** Локализованная подпись типа плана. */
export function planTypeLabel(type: PlanType): string {
  switch (type) {
    case "buy":
      return t("Buy", "Покупка");
    case "sell":
      return t("Sell", "Продажа");
    case "tx":
      return t("Trade", "Транзакция");
    case "in":
      return t("Deposit", "Пополнение");
    case "out":
      return t("Withdrawal", "Вывод");
    case "div":
      return t("Dividend", "Дивиденд");
  }
}
