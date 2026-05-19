/**
 * RecalcButton — кнопка «Пересчитать» с состояниями idle / В очереди /
 * Считается… {n}% / Готово / Ошибка. Запускает пересчёт указанных секций и
 * показывает прогресс. Все надписи — на русском (через t()).
 */
import { Feather } from "@expo/vector-icons";

import type { RecalcSection, RecalcUiState } from "@/shared/api/types";
import { t } from "@/shared/config/i18n";
import { colors } from "@/shared/config/theme";
import { Button } from "@/shared/ui";

import { useRecalc } from "./useRecalc";

function labelFor(state: RecalcUiState, progress: number): string {
  switch (state) {
    case "queued":
      return t("Queued", "В очереди");
    case "running":
      return `${t("Calculating", "Считается")}… ${progress}%`;
    case "done":
      return t("Done", "Готово");
    case "failed":
      return t("Error", "Ошибка");
    default:
      return t("Recalculate", "Пересчитать");
  }
}

export function RecalcButton({
  portfolioId,
  sections,
  size = "sm",
}: {
  portfolioId?: string;
  sections?: RecalcSection[];
  size?: "sm" | "md";
}) {
  const { uiState, progress, run, isBusy } = useRecalc(portfolioId, sections);
  const tone =
    uiState === "failed" ? colors.down : uiState === "done" ? colors.up : colors.ink3;
  const icon =
    uiState === "failed" ? "alert-triangle" : uiState === "done" ? "check" : "refresh-cw";
  return (
    <Button
      label={labelFor(uiState, progress)}
      size={size}
      variant="default"
      disabled={!portfolioId || isBusy}
      onPress={run}
      icon={<Feather name={icon} size={13} color={tone} />}
    />
  );
}
