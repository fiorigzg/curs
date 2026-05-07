/**
 * Overview — `dashboard.jsx :: Dashboard`. Десктоп layout:
 *   .content.overview (max-width 1180, padding 36 32 64)
 *   overview-hero  → hero-num 84px + ₽ + PercentDelta + hero-spark
 *   class-strip    → 3 cols, item: dot + label + sum + %, bar-track
 *   portfolios     → SectionHeader + grid auto-fill minmax(260,1fr)
 *   recent-tx      → SectionHeader + Card padded:false, tx-row × N + «Показать ещё»
 *
 * Mobile (<800): один столбец, hero 44px.
 */
import { Feather } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { useOverview, usePortfolios, useRecentTransactions } from "@/shared/api/hooks";
import type { PortfolioSummary, Transaction } from "@/shared/api/types";
import {
  classColor,
  classLabel,
  colors,
  fontSize,
  layout,
  letterSpacing,
  radius,
} from "@/shared/config/theme";
import { t } from "@/shared/config/i18n";
import { baseSym, fmtDateShort, fmtMoneyCompact } from "@/shared/lib/format";
import { useIsDesktop, useLayoutMode } from "@/shared/lib/responsive";
import { useApp } from "@/shared/store/app";
import {
  Button,
  Card,
  PercentDelta,
  SectionHeader,
  Sparkline,
  Txt,
} from "@/shared/ui";
import { useQuotesSocket } from "@/shared/ws/useQuotesSocket";
import { useQueryClient } from "@tanstack/react-query";

import { TxRow } from "@/entities/transaction/TxRow";
import { PortfolioCard } from "@/widgets/PortfolioCard";

const STRIP_CLASSES: Array<"tradfi" | "crypto" | "fiat"> = ["tradfi", "crypto", "fiat"];

export function OverviewScreen() {
  const qc = useQueryClient();
  const overview = useOverview();
  const portfolios = usePortfolios();
  const recent = useRecentTransactions(20);
  const isDesktop = useIsDesktop();
  const mode = useLayoutMode();
  const setRoute = useApp((s) => s.setRoute);
  const setActivePortfolio = useApp((s) => s.setActivePortfolio);
  const openAddTx = useApp((s) => s.openAddTx);
  const openEditTx = useApp((s) => s.openEditTx);
  const openAddPortfolio = useApp((s) => s.openAddPortfolio);

  const [txLimit, setTxLimit] = useState(6);

  useQuotesSocket(() => {
    qc.invalidateQueries({ queryKey: ["dashboard", "overview"] });
    qc.invalidateQueries({ queryKey: ["portfolios"] });
  }, true);

  const o = overview.data;
  const yearPct = o?.yearPct ?? 0;
  const positive = yearPct >= 0;

  const heroSize = isDesktop ? fontSize.heroNum : fontSize.heroNumMobile;
  const ccySize = isDesktop ? fontSize.heroCcy : 22;
  const contentMaxW = layout.contentOverviewMaxWidth;
  const padH = isDesktop ? 32 : 20;
  const padTop = isDesktop ? 36 : 16;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        paddingHorizontal: padH,
        paddingTop: padTop,
        paddingBottom: 64,
      }}
    >
      <View style={{ width: "100%", maxWidth: contentMaxW, alignSelf: "center" }}>
        {/* Hero ──────────────────────────────────────────── */}
        <View style={{ marginBottom: 32 }}>
          <Txt
            color={colors.ink3}
            size={fontSize.mini}
            weight="500"
            style={{ textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 14 }}
          >
            {t("Total across all portfolios", "Всего по всем портфелям")}
          </Txt>
          <View
            style={{
              flexDirection: "row",
              alignItems: "baseline",
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            <Txt
              size={heroSize}
              weight="500"
              mono
              style={{
                letterSpacing: letterSpacing.hero,
                lineHeight: heroSize,
              }}
            >
              {fmtMoneyCompact(o?.total ?? 0)}
            </Txt>
            <Txt color={colors.ink3} size={ccySize} weight="400">
              {baseSym()}
            </Txt>
            <PercentDelta value={o?.totalPlPct ?? 0} abs={o?.totalPl} />
          </View>

          {/* Hero spark */}
          <View
            style={{
              marginTop: 22,
              paddingTop: 16,
              borderTopWidth: 1,
              borderTopColor: colors.hairline,
              maxWidth: 720,
            }}
          >
            <Sparkline
              series={o?.series ?? []}
              width={isDesktop ? 680 : 340}
              height={64}
              positive={positive}
              thickness={1.6}
            />
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginTop: 6,
              }}
            >
              <Txt color={colors.ink3} size={fontSize.mini} mono>
                {o?.firstTxDate ? fmtDateShort(o.firstTxDate) : ""}
              </Txt>
              <Txt color={colors.ink3} size={fontSize.mini} mono>
                {t("now", "сейчас")}
              </Txt>
            </View>
          </View>
        </View>

        {/* Class strip ──────────────────────────────────── */}
        <View
          style={{
            flexDirection: mode === "mobile" ? "column" : "row",
            borderWidth: 1,
            borderColor: colors.hairline,
            borderRadius: radius.lg,
            overflow: "hidden",
            backgroundColor: colors.surface,
          }}
        >
          {STRIP_CLASSES.map((cls, i) => {
            const v = o?.byClass[cls] ?? 0;
            const pct = (o?.total ?? 0) > 0 ? v / (o!.total) : 0;
            const isLast = i === STRIP_CLASSES.length - 1;
            return (
              <View
                key={cls}
                style={{
                  flex: 1,
                  padding: 22,
                  paddingVertical: 20,
                  borderRightWidth: mode !== "mobile" && !isLast ? 1 : 0,
                  borderBottomWidth: mode === "mobile" && !isLast ? 1 : 0,
                  borderColor: colors.hairline,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      backgroundColor: classColor[cls],
                    }}
                  />
                  <Txt color={colors.ink2} size={fontSize.sub} weight="500">
                    {classLabel(cls)}
                  </Txt>
                </View>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                  <Txt size={22} weight="600" mono style={{ letterSpacing: letterSpacing.metric }}>
                    {fmtMoneyCompact(v)}
                    <Txt color={colors.ink3} size={13}>
                      {" "}
                      {baseSym()}
                    </Txt>
                  </Txt>
                  <Txt color={colors.ink3} size={fontSize.mini} mono>
                    {(pct * 100).toFixed(0)}%
                  </Txt>
                </View>
                <View
                  style={{
                    height: 6,
                    backgroundColor: colors.surface3,
                    borderRadius: 3,
                    marginTop: 8,
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      height: "100%",
                      width: `${pct * 100}%`,
                      backgroundColor: classColor[cls],
                    }}
                  />
                </View>
              </View>
            );
          })}
        </View>

        {/* Portfolios ───────────────────────────────────── */}
        <View style={{ marginTop: 36 }}>
          <SectionHeader
            title={t("Portfolios", "Портфели")}
            right={
              <Button
                variant="ghost"
                size="sm"
                label={t("Open analytics", "Перейти в аналитику")}
                trailingIcon={<Feather name="arrow-right" size={14} color={colors.ink2} />}
                onPress={() => setRoute("analytics")}
              />
            }
          />
          <PortfoliosGrid
            items={portfolios.data ?? []}
            onOpen={(id) => {
              setActivePortfolio(id);
              setRoute("portfolio");
            }}
            onAdd={openAddPortfolio}
            mobileMode={!isDesktop}
          />
        </View>

        {/* Recent transactions ─────────────────────────── */}
        <View style={{ marginTop: 36 }}>
          <SectionHeader
            title={t("Recent transactions", "Последние сделки")}
            right={
              <Button
                variant="ghost"
                size="sm"
                label={t("Add", "Добавить")}
                icon={<Feather name="plus" size={14} color={colors.ink2} />}
                onPress={() => openAddTx(null)}
              />
            }
          />
          <Card padded={false}>
            {(recent.data ?? []).slice(0, txLimit).map((t: Transaction) => (
              <TxRow
                key={t.id}
                tx={t}
                portfolioName={portfolios.data?.find((p: PortfolioSummary) => p.id === t.portfolio)?.name}
                portfolioColor={portfolios.data?.find((p: PortfolioSummary) => p.id === t.portfolio)?.color}
                onPress={() => openEditTx(t)}
              />
            ))}
            {(recent.data ?? []).length === 0 ? (
              <View style={{ padding: 24, alignItems: "center" }}>
                <Txt color={colors.ink3} size={fontSize.body}>
                  {t("No transactions yet", "Сделок пока нет")}
                </Txt>
              </View>
            ) : null}
            {recent.data && txLimit < recent.data.length ? (
              <Pressable
                onPress={() => setTxLimit((n) => n + 6)}
                style={{
                  paddingVertical: 14,
                  borderTopWidth: 1,
                  borderTopColor: colors.hairline2,
                  backgroundColor: colors.surface2,
                  alignItems: "center",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                  <Txt color={colors.ink2} size={fontSize.body} weight="500">
                    {t("Show more", "Показать ещё")}
                  </Txt>
                  <Txt color={colors.ink3} size={fontSize.mini} mono>
                    · {Math.min(6, recent.data.length - txLimit)}{" "}
                    {t("of", "из")} {recent.data.length - txLimit}
                  </Txt>
                </View>
              </Pressable>
            ) : null}
            {recent.data && txLimit >= recent.data.length && txLimit > 6 ? (
              <Pressable
                onPress={() => setTxLimit(6)}
                style={{
                  paddingVertical: 14,
                  borderTopWidth: 1,
                  borderTopColor: colors.hairline2,
                  backgroundColor: colors.surface2,
                  alignItems: "center",
                }}
              >
                <Txt color={colors.ink3} size={fontSize.body} weight="500">
                  {t("Collapse", "Свернуть")}
                </Txt>
              </Pressable>
            ) : null}
          </Card>
        </View>
      </View>
    </ScrollView>
  );
}

function PortfoliosGrid({
  items,
  onOpen,
  onAdd,
  mobileMode,
}: {
  items: {
    id: string;
    name: string;
    color: string;
    positionsCount: number;
    total: number;
    deltaPct90d: number;
    series90d: { d: string; v: number }[];
  }[];
  onOpen: (id: string) => void;
  onAdd: () => void;
  mobileMode: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 14,
      }}
    >
      {items.map((p) => (
        <View
          key={p.id}
          style={{
            flexGrow: 1,
            flexBasis: mobileMode ? "100%" : 260,
            maxWidth: mobileMode ? "100%" : 380,
            minWidth: 260,
          }}
        >
          <PortfolioCard pf={p} onPress={() => onOpen(p.id)} />
        </View>
      ))}
      <View
        style={{
          flexGrow: 1,
          flexBasis: mobileMode ? "100%" : 260,
          minWidth: 260,
        }}
      >
        <Pressable
          onPress={onAdd}
          style={{
            minHeight: 160,
            borderRadius: radius.lg,
            borderWidth: 1.5,
            borderStyle: "dashed",
            borderColor: colors.hairline,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "transparent",
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: colors.surface3,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather name="plus" size={14} color={colors.ink2} />
          </View>
          <Txt color={colors.ink2} size={fontSize.body} weight="500" style={{ marginTop: 12 }}>
            {t("New portfolio", "Новый портфель")}
          </Txt>
        </Pressable>
      </View>
    </View>
  );
}
