/**
 * TopBar — `.topbar` из styles.css (десктоп):
 *   padding 18 28, gap 18, borderBottom hairline, sticky top z 5, bg bg.
 *
 *  - breadcrumbs (`.crumbs`): «CURS / Обзор» / «CURS / Портфели / {name}» и т.д.
 */
import { Fragment, useMemo } from "react";
import { View } from "react-native";

import { usePortfolios } from "@/shared/api/hooks";
import { t } from "@/shared/config/i18n";
import { colors, fontSize } from "@/shared/config/theme";
import { useApp } from "@/shared/store/app";
import { Txt } from "@/shared/ui";

export function TopBar() {
  const route = useApp((s) => s.route);
  const activePortfolio = useApp((s) => s.activePortfolio);
  const { data: portfolios = [] } = usePortfolios();

  const crumbs = useMemo(() => {
    const pfName =
      portfolios.find((p: { id: string }) => p.id === activePortfolio)?.name ?? "—";
    switch (route) {
      case "dashboard":
        return ["CURS", t("Overview", "Обзор")];
      case "portfolio":
        return ["CURS", t("Portfolios", "Портфели"), pfName];
      case "analytics":
        return ["CURS", t("Analytics", "Аналитика"), pfName];
      case "settings":
        return ["CURS", t("Settings", "Настройки")];
    }
  }, [route, activePortfolio, portfolios]);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 18,
        paddingVertical: 18,
        paddingHorizontal: 28,
        borderBottomWidth: 1,
        borderBottomColor: colors.hairline,
        backgroundColor: colors.bg,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 }}>
        {crumbs.map((c, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <Fragment key={`${i}-${c}`}>
              {i > 0 ? (
                <Txt color={colors.ink4} size={fontSize.body}>
                  /
                </Txt>
              ) : null}
              <Txt
                color={isLast ? colors.ink : colors.ink3}
                weight={isLast ? "500" : "400"}
                size={fontSize.body}
              >
                {c}
              </Txt>
            </Fragment>
          );
        })}
      </View>
    </View>
  );
}
