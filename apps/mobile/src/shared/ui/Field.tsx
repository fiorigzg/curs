/**
 * Field / Input / Select — `.field` / `.field-label` / `.inp` / `.pill-btn` (pills variant) из styles.css.
 *
 * .inp           h 38, padding 0 12, border hairline, radius 9, bg surface, fz 14.
 * .inp:focus     borderColor ink.
 * .field-label   fz 11/500, upper, letterSpacing 0.06em, color ink-3, margin-bottom 6.
 *
 * .pill-btn      padding 6 12, radius 8, bg surface-2, color ink-2.
 * .pill-btn.active   bg ink, color surface.
 */
import { useState, type ReactNode } from "react";
import { Pressable, TextInput, View, type TextStyle, type ViewStyle } from "react-native";

import { colors, fontSize, radius } from "@/shared/config/theme";

import { Txt } from "./Txt";

export function Field({
  label,
  hint,
  children,
  style,
}: {
  label?: string;
  hint?: string;
  children: ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={[{ gap: 6 }, style]}>
      {label ? (
        <Txt
          color={colors.ink3}
          size={fontSize.mini}
          weight="500"
          style={{ textTransform: "uppercase", letterSpacing: 0.66 }}
        >
          {label}
        </Txt>
      ) : null}
      {children}
      {hint ? (
        <Txt color={colors.ink3} size={fontSize.sub}>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

interface InputProps {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric" | "decimal-pad" | "email-address";
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences";
  /** Принимать только цифры/точку (для price/qty). */
  numeric?: boolean;
  /** Текстовый суффикс (₽/$/%/USD) — рисует группу .inp-row. */
  suffix?: string;
  style?: ViewStyle;
}

export function Input({
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secureTextEntry,
  autoCapitalize,
  numeric,
  suffix,
  style,
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const borderColor = focused ? colors.ink : colors.hairline;

  const rawInput = (innerStyle: TextStyle) => (
    <TextInput
      value={value}
      onChangeText={(v) => onChangeText(numeric ? v.replace(/[^\d.,]/g, "").replace(",", ".") : v)}
      placeholder={placeholder}
      placeholderTextColor={colors.ink4}
      keyboardType={keyboardType ?? (numeric ? "decimal-pad" : "default")}
      secureTextEntry={secureTextEntry}
      autoCapitalize={autoCapitalize}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        {
          fontSize: fontSize.body,
          color: colors.ink,
          height: 38,
        },
        innerStyle,
      ]}
    />
  );

  if (!suffix) {
    return (
      <View
        style={[
          {
            borderWidth: 1,
            borderColor,
            borderRadius: radius.field,
            backgroundColor: colors.surface,
          },
          style,
        ]}
      >
        {rawInput({ paddingHorizontal: 12 })}
      </View>
    );
  }

  // Inline-группа .inp-row с правым суффиксом.
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "stretch",
          borderWidth: 1,
          borderColor,
          borderRadius: radius.field,
          backgroundColor: colors.surface,
          overflow: "hidden",
        },
        style,
      ]}
    >
      <View style={{ flex: 1 }}>{rawInput({ paddingHorizontal: 12 })}</View>
      <View
        style={{
          paddingHorizontal: 14,
          backgroundColor: colors.surface2,
          borderLeftWidth: 1,
          borderLeftColor: colors.hairline2,
          justifyContent: "center",
        }}
      >
        <Txt color={colors.ink3} size={fontSize.sub} mono>
          {suffix}
        </Txt>
      </View>
    </View>
  );
}

/**
 * Pill-варианты вместо нативного <select> — соответствует .pill-btn из styles.css
 * (там, где в дизайне был выбор из 3-4 значений).
 */
export function Select({
  options,
  value,
  onChange,
  fullWidth,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  fullWidth?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: radius.button,
              backgroundColor: active ? colors.ink : colors.surface2,
              borderWidth: 1,
              borderColor: active ? colors.ink : "transparent",
              ...(fullWidth ? { flexGrow: 1, alignItems: "center" as const } : {}),
            }}
          >
            <Txt color={active ? colors.surface : colors.ink2} size={fontSize.sub} weight="500">
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}
