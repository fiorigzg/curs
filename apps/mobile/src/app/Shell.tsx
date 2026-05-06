/**
 * Shell — корневой layout приложения после логина.
 *
 *   desktop (≥1200): Sidebar 232px + TopBar + content (max-width 1480/1180/wide).
 *   tablet  (800–1199): collapsed-sidebar (потом) + content; пока — мобильный layout.
 *   mobile  (<800): шапка (greeting) + content + bottom-tabs (как было).
 *
 * Роутинг — Zustand `useApp.route`, без react-navigation (sidebar и tabs работают
 * с одним стейтом, проще). Экраны рендерятся switch'ем.
 */
import { useMemo } from "react";
import { View } from "react-native";

import { useApp } from "@/shared/store/app";
import { colors, layout } from "@/shared/config/theme";
import { useLayoutMode } from "@/shared/lib/responsive";

import { Sidebar } from "@/widgets/Sidebar";
import { TopBar } from "@/widgets/TopBar";

import { OverviewScreen } from "@/pages/overview/OverviewScreen";
import { PortfolioScreen } from "@/pages/portfolio/PortfolioScreen";
import { AnalyticsScreen } from "@/pages/analytics/AnalyticsScreen";
import { SettingsScreen } from "@/pages/settings/SettingsScreen";

import { AddTxModal } from "@/features/add-tx/AddTxModal";
import { CreatePortfolioModal } from "@/features/add-tx/CreatePortfolioModal";

export function Shell() {
  const mode = useLayoutMode();
  const route = useApp((s) => s.route);

  const screen = useMemo(() => {
    switch (route) {
      case "dashboard":
        return <OverviewScreen />;
      case "portfolio":
        return <PortfolioScreen />;
      case "analytics":
        return <AnalyticsScreen />;
      case "settings":
        return <SettingsScreen />;
    }
  }, [route]);

  if (mode === "desktop") {
    return (
      <View style={{ flex: 1, flexDirection: "row", backgroundColor: colors.bg }}>
        <View style={{ width: layout.sidebarWidth }}>
          <Sidebar />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <TopBar />
          <View style={{ flex: 1 }}>{screen}</View>
        </View>
        <Overlays />
      </View>
    );
  }

  // tablet / mobile — fallback на одну колонку с topbar сверху.
  // Полноценный bottom-tabs допилим позже; сейчас web focus.
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar />
      <View style={{ flex: 1 }}>{screen}</View>
      <Overlays />
    </View>
  );
}

function Overlays() {
  return (
    <>
      <AddTxModal />
      <CreatePortfolioModal />
    </>
  );
}
