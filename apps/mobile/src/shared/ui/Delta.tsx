/**
 * PercentDelta — `.delta.up/.down` + опциональная абсолютная сумма (как в ui.jsx).
 * Не показывает NaN: если value не finite → возвращает прочерк.
 */
import { View } from "react-native";

import { colors, fontSize } from "@/shared/config/theme";
import { baseSym, fmtMoneyCompact } from "@/shared/lib/format";

import { Txt } from "./Txt";

interface Props {
  value: number;
  /** Размер в px. */
  size?: number;
  withArrow?: boolean;
  /** Опциональная абсолютная сумма (для inline `+15к ₽`). */
  abs?: number;
  /** Доп. серый суффикс справа (`за 1Г` и т.п.). */
  suffix?: string;
}

export function PercentDelta({ value, size = 13, withArrow = true, abs, suffix }: Props) {
  if (!Number.isFinite(value)) {
    return (
      <Txt color={colors.ink3} size={size} mono>
        —
      </Txt>
    );
  }
  const positive = value >= 0;
  const color = positive ? colors.up : colors.down;
  const arrow = positive ? "▲" : "▼";
  const pct = (Math.abs(value) * 100).toFixed(2).replace(".", ",");
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
      <Txt color={color} size={size} weight="600" mono>
        {withArrow ? `${arrow} ` : positive ? "+" : "−"}
        {pct}%
      </Txt>
      {Number.isFinite(abs) ? (
        <Txt color={color} size={size - 1} weight="500" mono>
          {positive ? "+" : "−"}
          {fmtMoneyCompact(Math.abs(abs as number))} {baseSym()}
        </Txt>
      ) : null}
      {suffix ? (
        <Txt color={colors.ink3} size={fontSize.mini}>
          {suffix}
        </Txt>
      ) : null}
    </View>
  );
}
