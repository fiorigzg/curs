/**
 * Pill — `.pill` из styles.css:
 *   h 22, padding 0 8, radius 999, fz 11/500, surface-3 bg.
 *   variants: up / down / ghost / solid / warn / lg.
 */
import type { ReactNode } from "react";
import { View } from "react-native";

import { colors, fontSize, radius } from "@/shared/config/theme";

import { Txt } from "./Txt";

export type PillTone = "default" | "up" | "down" | "ghost" | "solid" | "warn";
export type PillSize = "sm" | "lg";

interface Props {
  children: ReactNode;
  tone?: PillTone;
  size?: PillSize;
  dotColor?: string;
}

const TONES: Record<PillTone, { bg: string; color: string; border: string }> = {
  default: { bg: colors.surface3, color: colors.ink2, border: colors.hairline },
  up: { bg: colors.upSoft, color: colors.upInk, border: "transparent" },
  down: { bg: colors.downSoft, color: colors.downInk, border: "transparent" },
  warn: { bg: colors.warnSoft, color: colors.warn, border: "transparent" },
  ghost: { bg: "transparent", color: colors.ink2, border: colors.hairline },
  solid: { bg: colors.ink, color: colors.surface, border: colors.ink },
};

export function Pill({ children, tone = "default", size = "sm", dotColor }: Props) {
  const t = TONES[tone];
  const h = size === "lg" ? 26 : 22;
  const px = size === "lg" ? 10 : 8;
  const fz = size === "lg" ? fontSize.sub : fontSize.pill;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        height: h,
        paddingHorizontal: px,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: t.border,
        backgroundColor: t.bg,
      }}
    >
      {dotColor ? (
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dotColor }} />
      ) : null}
      <Txt color={t.color} size={fz} weight="500">
        {typeof children === "string" || typeof children === "number" ? String(children) : (children as never)}
      </Txt>
    </View>
  );
}

/** Alias для совместимости — старый Chip фактически = Pill default. */
export { Pill as Chip };
