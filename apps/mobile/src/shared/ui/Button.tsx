/**
 * Button — перенос `.btn` / `.btn.primary` / `.btn.ghost` / `.btn.sm` / `.btn.icon` из styles.css.
 *
 * .btn         h 32, padding 0 12, radius 8, border hairline, fz 13/500, surface bg
 * .btn:hover   bg surface-2, borderColor ink-4
 * .btn:active  translateY(1)
 * .btn.primary bg ink, surface text, border ink; hover → #000
 * .btn.ghost   bg transparent, border transparent; hover → surface-3
 * .btn.sm      h 26, padding 0 8, fz 12
 * .btn.icon    width 32, padding 0, square
 */
import { useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, View, type ViewStyle } from "react-native";

import { colors, fontSize, radius } from "@/shared/config/theme";

import { Txt } from "./Txt";

export type ButtonVariant = "default" | "primary" | "ghost";
export type ButtonSize = "sm" | "md" | "icon";

interface Props {
  label?: string;
  icon?: ReactNode;
  trailingIcon?: ReactNode;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle | ViewStyle[];
  title?: string;
  /** Заполнить ширину контейнера (для модальных футеров и т.п.). */
  fullWidth?: boolean;
}

const HEIGHT = { sm: 26, md: 32, icon: 32 };
const FZ = { sm: fontSize.buttonSm, md: fontSize.button, icon: fontSize.button };

export function Button({
  label,
  icon,
  trailingIcon,
  onPress,
  variant = "default",
  size = "md",
  disabled,
  loading,
  style,
  fullWidth,
}: Props) {
  const [hover, setHover] = useState(false);
  const primary = variant === "primary";
  const ghost = variant === "ghost";

  const bg = primary
    ? hover
      ? colors.black
      : colors.ink
    : ghost
      ? hover
        ? colors.surface3
        : "transparent"
      : hover
        ? colors.surface2
        : colors.surface;
  const border = primary
    ? colors.ink
    : ghost
      ? "transparent"
      : hover
        ? colors.ink4
        : colors.hairline;
  const color = primary ? colors.surface : colors.ink;

  const isIcon = size === "icon";

  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      style={({ pressed }) => [
        {
          height: HEIGHT[size],
          paddingHorizontal: isIcon ? 0 : size === "sm" ? 8 : 12,
          width: isIcon ? HEIGHT.icon : fullWidth ? "100%" : undefined,
          borderRadius: radius.button,
          borderWidth: 1,
          borderColor: border,
          backgroundColor: bg,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 6,
          opacity: disabled ? 0.5 : 1,
          transform: pressed ? [{ translateY: 1 }] : undefined,
        },
        style as ViewStyle,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={color} size="small" />
      ) : (
        <>
          {icon ? <View>{icon}</View> : null}
          {label ? (
            <Txt color={color} size={FZ[size]} weight="500">
              {label}
            </Txt>
          ) : null}
          {trailingIcon ? <View>{trailingIcon}</View> : null}
        </>
      )}
    </Pressable>
  );
}
