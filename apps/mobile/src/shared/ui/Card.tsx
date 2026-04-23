/**
 * Card — `.card` из styles.css: surface, hairline 1px, radius lg (16), padding 22 (cozy).
 * Варианты: default, flat (surface-2 + hairline-2), dark (ink bg + surface text).
 */
import type { ReactNode } from "react";
import { View, type ViewStyle } from "react-native";

import { colors, radius } from "@/shared/config/theme";

interface Props {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
  variant?: "default" | "flat" | "dark";
  /** false → убрать внутренний padding (для карточек-таблиц). */
  padded?: boolean;
  padding?: number;
}

export function Card({ children, style, variant = "default", padded = true, padding }: Props) {
  const bg =
    variant === "dark" ? colors.ink : variant === "flat" ? colors.surface2 : colors.surface;
  const border =
    variant === "dark" ? colors.ink : variant === "flat" ? colors.hairline2 : colors.hairline;

  return (
    <View
      style={[
        {
          backgroundColor: bg,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: border,
          overflow: "hidden",
          ...(padded ? { padding: padding ?? 22 } : {}),
        },
        style as ViewStyle,
      ]}
    >
      {children}
    </View>
  );
}
