/**
 * PortfolioCard — `.portfolio-card` из styles.css:
 *   bg surface, border hairline, radius lg (16), padding 20, hover → border ink.
 *   Header row: color-dot + name fz 15/600 + N позиций mini.  Sparkline 100x28 справа.
 *   Footer: total mono 26/600 ls -0.025em + PercentDelta.
 */
import { useState } from "react";
import { Pressable, View } from "react-native";

import type { PortfolioSummary } from "@/shared/api/types";
import { t } from "@/shared/config/i18n";
import { colors, fontSize, letterSpacing, radius } from "@/shared/config/theme";
import { baseSym, fmtMoneyCompact } from "@/shared/lib/format";
import { PercentDelta, Sparkline, Txt } from "@/shared/ui";

export function PortfolioCard({
  pf,
  onPress,
}: {
  pf: PortfolioSummary;
  onPress: () => void;
}) {
  const [hover, setHover] = useState(false);
  const positive = (pf.deltaPct90d ?? 0) >= 0;
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      style={({ pressed }) => ({
        padding: 20,
        // hover-подсветка как у строки транзакции: меняем фон на surface2.
        backgroundColor: hover ? colors.surface2 : colors.surface,
        borderWidth: 1,
        borderColor: colors.hairline,
        borderRadius: radius.lg,
        transform: pressed ? [{ translateY: 1 }] : undefined,
        minHeight: 160,
      })}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 18,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, flex: 1 }}>
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              backgroundColor: pf.color,
              marginTop: 5,
            }}
          />
          <View style={{ minWidth: 0 }}>
            <Txt size={15} weight="600" style={{ letterSpacing: -0.15 }} numberOfLines={1}>
              {pf.name}
            </Txt>
            <Txt color={colors.ink3} size={fontSize.mini}>
              {t(`${pf.positionsCount} positions`, `${pf.positionsCount} позиций`)}
            </Txt>
          </View>
        </View>
        <Sparkline
          series={pf.series90d ?? []}
          width={100}
          height={28}
          positive={positive}
          thickness={1.4}
        />
      </View>
      <View style={{ gap: 4 }}>
        <Txt size={26} weight="600" mono style={{ letterSpacing: letterSpacing.metric }}>
          {fmtMoneyCompact(pf.total)}
          <Txt color={colors.ink3} size={14}>
            {" "}
            {baseSym()}
          </Txt>
        </Txt>
        <PercentDelta value={pf.deltaPct90d ?? 0} />
      </View>
    </Pressable>
  );
}
