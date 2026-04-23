/**
 * SectionHeader — `.section-title.lg` из styles.css:
 *   fz 16/600, color ink. .sub — fz 14 ink-3 inline.
 *
 * PageHead — `.page-head .title` (fz 28/600 ls -0.025em) + .sub (ink-3 fz 14).
 */
import type { ReactNode } from "react";
import { View } from "react-native";

import { colors, fontSize, letterSpacing } from "@/shared/config/theme";

import { Txt } from "./Txt";

export function SectionHeader({
  title,
  sub,
  right,
}: {
  title: string;
  sub?: string;
  right?: ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
        marginBottom: 14,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, flex: 1 }}>
        <Txt size={fontSize.sectionTitleLg} weight="600">
          {title}
        </Txt>
        {sub ? (
          <Txt color={colors.ink3} size={fontSize.body}>
            {sub}
          </Txt>
        ) : null}
      </View>
      {right ? <View style={{ flexDirection: "row", gap: 6 }}>{right}</View> : null}
    </View>
  );
}

export function PageHead({
  title,
  sub,
  right,
  pre,
}: {
  title: string;
  sub?: ReactNode;
  right?: ReactNode;
  pre?: ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        gap: 18,
        marginBottom: 22,
      }}
    >
      <View style={{ flex: 1 }}>
        {pre}
        <Txt
          size={fontSize.pageTitle}
          weight="600"
          style={{ letterSpacing: letterSpacing.metric, lineHeight: fontSize.pageTitle }}
        >
          {title}
        </Txt>
        {sub ? (
          <View style={{ marginTop: 6 }}>
            {typeof sub === "string" ? (
              <Txt color={colors.ink3} size={fontSize.body}>
                {sub}
              </Txt>
            ) : (
              sub
            )}
          </View>
        ) : null}
      </View>
      {right ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>{right}</View>
      ) : null}
    </View>
  );
}

/** Маленькая uppercase подпись над списком (например в Settings). */
export function SectionLabel({ children }: { children: string }) {
  return (
    <Txt
      color={colors.ink3}
      size={fontSize.mini}
      weight="500"
      style={{
        textTransform: "uppercase",
        letterSpacing: 0.66,
        marginBottom: 8,
      }}
    >
      {children}
    </Txt>
  );
}
