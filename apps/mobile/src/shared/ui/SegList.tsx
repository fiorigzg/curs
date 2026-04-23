/**
 * SegList — `.seg-list` / `.seg-card` из styles.css.
 *
 *   grid 3 кол. (по умолчанию) или 2 кол. (`columns=2`, эквивалент .seg-list-4),
 *   каждая ячейка — кнопка с маркером (точка/иконка) + label + опц. sub.
 *   active: borderColor ink, bg surface-2, inset shadow ink (имитируем 2px-обводкой).
 */
import { Pressable, View } from "react-native";

import { colors, fontSize, radius } from "@/shared/config/theme";

import { Txt } from "./Txt";

export interface SegOption {
  key: string;
  label: string;
  sub?: string;
  /** Цветная точка слева (например для классов активов). */
  dot?: string;
  /** Иконка слева (28px квадрат) — для tx-типов. */
  icon?: { glyph: string; bg: string; fg: string };
}

export function SegList({
  options,
  value,
  onChange,
  columns = 3,
}: {
  options: SegOption[];
  value: string;
  onChange: (k: string) => void;
  columns?: 2 | 3;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map((o) => {
        const active = value === o.key;
        // Раскладка через flex-basis, чтобы соответствовать grid-template-columns: repeat(N, 1fr).
        const basis = columns === 2 ? "48%" : "31%";
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={{
              flexGrow: 1,
              flexBasis: basis,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderRadius: radius.md,
              borderWidth: active ? 2 : 1,
              borderColor: active ? colors.ink : colors.hairline,
              backgroundColor: active ? colors.surface2 : colors.surface,
            }}
          >
            {o.icon ? (
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  backgroundColor: o.icon.bg,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Txt color={o.icon.fg} size={13} weight="700">
                  {o.icon.glyph}
                </Txt>
              </View>
            ) : null}
            {o.dot ? (
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  backgroundColor: o.dot,
                }}
              />
            ) : null}
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Txt size={fontSize.button} weight="600">
                {o.label}
              </Txt>
              {o.sub ? (
                <Txt color={colors.ink3} size={fontSize.mini}>
                  {o.sub}
                </Txt>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
