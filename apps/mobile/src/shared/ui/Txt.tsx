import { Text, type TextProps, type TextStyle } from "react-native";

import { colors, font } from "@/shared/config/theme";

interface Props extends TextProps {
  color?: string;
  size?: number;
  weight?: TextStyle["fontWeight"];
  /** mono = "Geist Mono" + tabular nums; для денег/процентов/тикеров (styles.css .mono). */
  mono?: boolean;
  /** serif = "Instrument Serif"; для аннотаций (styles.css .annot). */
  serif?: boolean;
  italic?: boolean;
}

export function Txt({
  color = colors.ink,
  size = 14,
  weight = "400",
  mono,
  serif,
  italic,
  style,
  ...rest
}: Props) {
  return (
    <Text
      {...rest}
      style={[
        {
          color,
          fontSize: size,
          fontWeight: weight,
          fontFamily: mono ? font.mono : serif ? font.serif : font.sans,
          ...(mono ? { letterSpacing: -0.3 } : {}),
          ...(italic ? { fontStyle: "italic" as const } : {}),
        },
        style,
      ]}
    />
  );
}
