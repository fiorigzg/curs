/**
 * Sidebar — `.sidebar` из styles.css (десктоп):
 *   width 232, sticky top 0, h 100vh, padding 22 16 18, borderRight hairline, bg bg.
 *
 *  - brand: mark 28x28 ink bg + accent2 "C" mono, name "CURS"
 *  - 4 nav-item: Обзор / Аналитика / Планировщик / Настройки
 *  - nav-section "Портфели" с кнопкой ⊕ справа и динамическим списком
 *  - footer: user-card
 */
import { Feather } from "@expo/vector-icons";
import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { usePortfolios } from "@/shared/api/hooks";
import type { PortfolioSummary } from "@/shared/api/types";
import { t } from "@/shared/config/i18n";
import { colors, fontSize, radius } from "@/shared/config/theme";
import { fmtMoneyCompact } from "@/shared/lib/format";
import { useApp, type Route } from "@/shared/store/app";
import { useAuth } from "@/shared/store/auth";
import { Txt } from "@/shared/ui";

interface NavItemSpec {
  key: Route;
  // thunk, а не строка: t() должен вычисляться в рендере (смена языка → ремоунт),
  // иначе метки заморозятся на языке, активном при загрузке модуля.
  label: () => string;
  icon: keyof typeof Feather.glyphMap;
}
const NAV: NavItemSpec[] = [
  { key: "dashboard", label: () => t("Overview", "Обзор"), icon: "home" },
  { key: "analytics", label: () => t("Analytics", "Аналитика"), icon: "bar-chart-2" },
  { key: "settings", label: () => t("Settings", "Настройки"), icon: "settings" },
];

export function Sidebar() {
  const route = useApp((s) => s.route);
  const setRoute = useApp((s) => s.setRoute);
  const setActivePortfolio = useApp((s) => s.setActivePortfolio);
  const activePortfolio = useApp((s) => s.activePortfolio);
  const openAddPortfolio = useApp((s) => s.openAddPortfolio);
  const user = useAuth((s) => s.user);
  const { data: portfolios = [] } = usePortfolios();

  const displayName = user?.displayName ?? "—";
  const email = user?.email ?? "";
  const initials = displayName
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <View
      style={{
        width: 232,
        height: "100%",
        paddingTop: 22,
        paddingHorizontal: 16,
        paddingBottom: 18,
        backgroundColor: colors.bg,
        borderRightWidth: 1,
        borderRightColor: colors.hairline,
        flexDirection: "column",
      }}
    >
      {/* Brand */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingHorizontal: 8,
          paddingTop: 6,
          paddingBottom: 22,
        }}
      >
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            backgroundColor: colors.ink,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Txt color={colors.accent2} size={13} weight="700" mono>
            C
          </Txt>
        </View>
        <Txt size={fontSize.brand} weight="600" style={{ letterSpacing: -0.32 }}>
          CURS
        </Txt>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 2 }}>
        {NAV.map((n) => (
          <NavItem
            key={n.key}
            label={n.label()}
            iconName={n.icon}
            active={route === n.key}
            onPress={() => {
              setRoute(n.key);
              if (n.key !== "dashboard") setActivePortfolio(null);
            }}
          />
        ))}

        <NavSection title={t("PORTFOLIOS", "Портфели")} onAdd={openAddPortfolio} />
        {portfolios.map((p: PortfolioSummary) => (
          <NavPortfolio
            key={p.id}
            portfolio={p}
            active={route === "portfolio" && activePortfolio === p.id}
            onPress={() => {
              setActivePortfolio(p.id);
              setRoute("portfolio");
            }}
          />
        ))}
      </ScrollView>

      {/* Footer */}
      <View style={{ gap: 12 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            padding: 10,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.hairline,
            borderRadius: radius.md,
          }}
        >
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.accent3,
            }}
          >
            <Txt color={colors.white} size={12} weight="600">
              {initials}
            </Txt>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt size={fontSize.body} weight="500" numberOfLines={1}>
              {displayName}
            </Txt>
            <Txt color={colors.ink3} size={fontSize.mini} numberOfLines={1}>
              {email}
            </Txt>
          </View>
        </View>
      </View>
    </View>
  );
}

function NavItem({
  label,
  iconName,
  active,
  onPress,
  count,
}: {
  label: string;
  iconName: keyof typeof Feather.glyphMap;
  active: boolean;
  onPress: () => void;
  count?: ReactNode;
}) {
  const [hover, setHover] = useState(false);
  const bg = active ? colors.ink : hover ? colors.surface3 : "transparent";
  const iconColor = active ? colors.accent2 : colors.ink3;
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: radius.button,
        backgroundColor: bg,
      }}
    >
      <View style={{ width: 16, height: 16, alignItems: "center", justifyContent: "center" }}>
        <Feather name={iconName} size={16} color={iconColor} />
      </View>
      <Txt color={active ? colors.surface : colors.ink2} size={fontSize.body} weight="500">
        {label}
      </Txt>
      {count !== undefined ? (
        <View style={{ marginLeft: "auto" }}>
          <Txt color={active ? colors.accent2 : colors.ink4} size={fontSize.mini} mono>
            {count as string}
          </Txt>
        </View>
      ) : null}
    </Pressable>
  );
}

function NavSection({ title, onAdd }: { title: string; onAdd?: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 10,
        paddingTop: 16,
        paddingBottom: 6,
      }}
    >
      <Txt
        color={colors.ink4}
        size={fontSize.mini}
        weight="500"
        style={{ textTransform: "uppercase", letterSpacing: 0.66 }}
      >
        {title}
      </Txt>
      {onAdd ? (
        <Pressable
          onPress={onAdd}
          onHoverIn={() => setHover(true)}
          onHoverOut={() => setHover(false)}
          style={{
            width: 18,
            height: 18,
            borderRadius: 4,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: hover ? colors.surface3 : "transparent",
          }}
        >
          <Feather name="plus" size={11} color={hover ? colors.ink : colors.ink3} />
        </Pressable>
      ) : null}
    </View>
  );
}

function NavPortfolio({
  portfolio,
  active,
  onPress,
}: {
  portfolio: PortfolioSummary;
  active: boolean;
  onPress: () => void;
}) {
  const [hover, setHover] = useState(false);
  const bg = active ? colors.ink : hover ? colors.surface3 : "transparent";
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 9,
        paddingLeft: 11,
        paddingRight: 10,
        paddingVertical: 8,
        borderRadius: radius.button,
        backgroundColor: bg,
      }}
    >
      <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: portfolio.color }} />
      <Txt
        color={active ? colors.surface : colors.ink2}
        size={fontSize.body}
        weight="500"
        numberOfLines={1}
        style={{ flex: 1 }}
      >
        {portfolio.name}
      </Txt>
      <Txt color={active ? colors.accent2 : colors.ink3} size={fontSize.mini} mono>
        {fmtMoneyCompact(portfolio.total)}
      </Txt>
    </Pressable>
  );
}
