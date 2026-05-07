/**
 * Portfolio — `portfolio.jsx :: PortfolioScreen` 1-в-1.
 *
 * Desktop:
 *   .page-head (dot + pill "N позиций" + title 28/600 ls -0.025em)
 *   .portfolio-strip — 3 strip-item + vh separator + sparkline 220x48
 *   SectionHeader "Позиции" + tabs (Все/tradfi/crypto/fiat) с counts + sub "N из M"
 *   Card padded:false → таблица `.tbl` (6 cols, sortable)
 *   SectionHeader "Сделки" → Card padded:false → tx-list × 14
 *
 * Mobile:
 *   page-head стэк, strip 2x2, фильтры — горизонтальный скролл, таблица → карточки.
 */
import { Feather } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import {
  useDeletePlan,
  useExecutePlan,
  usePlans,
  usePortfolio,
  usePortfolioTransactions,
} from "@/shared/api/hooks";
import type { AssetClass, Plan, Position } from "@/shared/api/types";
import { t } from "@/shared/config/i18n";
import {
  colors,
  fontSize,
  layout,
  letterSpacing,
  radius,
} from "@/shared/config/theme";
import { baseSym, fmtMoney, fmtMoneyCompact, fmtQty, fmtUnit } from "@/shared/lib/format";
import { useIsDesktop } from "@/shared/lib/responsive";
import { useApp } from "@/shared/store/app";
import {
  AssetIcon,
  Button,
  Card,
  PageHead,
  PercentDelta,
  Pill,
  SectionHeader,
  Tabs,
  Txt,
} from "@/shared/ui";

import { PortfolioChart } from "@/widgets/PortfolioChart";

import { PlanRow } from "@/entities/transaction/PlanRow";
import { TxRow } from "@/entities/transaction/TxRow";

type ClassFilter = "all" | AssetClass;

export function PortfolioScreen() {
  const portfolioId = useApp((s) => s.activePortfolio);
  const setRoute = useApp((s) => s.setRoute);
  const openAddTx = useApp((s) => s.openAddTx);
  const openEditTx = useApp((s) => s.openEditTx);
  const openAddPlan = useApp((s) => s.openAddPlan);
  const openEditPlan = useApp((s) => s.openEditPlan);
  const openEditPortfolio = useApp((s) => s.openEditPortfolio);
  const isDesktop = useIsDesktop();

  const { data: pf } = usePortfolio(portfolioId);
  const { data: txs = [] } = usePortfolioTransactions(portfolioId, 500);
  const { data: allPlans = [] } = usePlans();
  const execPlan = useExecutePlan();
  const delPlan = useDeletePlan();
  const plans = useMemo(
    () => allPlans.filter((p: Plan) => p.portfolioId === portfolioId),
    [allPlans, portfolioId],
  );

  const [classFilter, setClassFilter] = useState<ClassFilter>("all");
  const [txLimit, setTxLimit] = useState(8); // постраничная подгрузка сделок (как на Overview)

  const positions = useMemo<Position[]>(() => {
    if (!pf) return [];
    return pf.positions
      .filter((p: Position) => classFilter === "all" || p.to.class === classFilter)
      .slice()
      // открытые сверху, закрытые снизу; внутри — по текущей стоимости.
      .sort((a: Position, b: Position) => Number(a.closed) - Number(b.closed) || b.valBase - a.valBase);
  }, [pf, classFilter]);

  // Счётчики табов — только открытые позиции (по классу held-актива `to`).
  const counts = useMemo(() => {
    const c: Record<"all" | AssetClass, number> = { all: 0, tradfi: 0, crypto: 0, fiat: 0 };
    if (pf) {
      pf.positions.forEach((p: Position) => {
        if (p.closed) return;
        c.all++;
        c[p.to.class]++;
      });
    }
    return c;
  }, [pf]);

  if (!portfolioId) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Txt color={colors.ink3} size={fontSize.body}>
          {t("Select a portfolio in the sidebar", "Выберите портфель в сайдбаре")}
        </Txt>
        <Button label={t("Back to Overview", "К Обзору")} variant="ghost" onPress={() => setRoute("dashboard")} />
      </View>
    );
  }

  const padH = isDesktop ? layout.contentPadding : 20;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        paddingHorizontal: padH,
        paddingTop: 28,
        paddingBottom: 64,
      }}
    >
      <View style={{ width: "100%", maxWidth: layout.contentMaxWidth, alignSelf: "center" }}>
        <PageHead
          title={pf?.name ?? "…"}
          pre={
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <View
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  backgroundColor: pf?.color ?? colors.ink,
                }}
              />
              <Pill tone="default">{t(`${counts.all} positions`, `${counts.all} позиций`)}</Pill>
            </View>
          }
          right={
            pf ? (
              <Button
                label={t("Edit", "Изменить")}
                icon={<Feather name="edit-2" size={13} color={colors.ink2} />}
                onPress={() => openEditPortfolio({ id: pf.id, name: pf.name, color: pf.color })}
              />
            ) : undefined
          }
        />

        {/* Strip ───────────────────────────────────────── */}
        <View
          style={{
            flexDirection: isDesktop ? "row" : "column",
            alignItems: isDesktop ? "center" : "stretch",
            gap: 32,
            paddingHorizontal: 24,
            paddingVertical: 20,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.hairline,
            borderRadius: radius.lg,
            marginBottom: 28,
          }}
        >
          <View style={{ flex: 1 }}>
            <Txt color={colors.ink3} size={fontSize.mini}>
              {t("Value", "Стоимость")}
            </Txt>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
              <Txt size={30} weight="600" mono style={{ letterSpacing: letterSpacing.metric }}>
                {fmtMoneyCompact(pf?.total ?? 0)}
                <Txt color={colors.ink3} size={15}>
                  {" "}
                  {baseSym()}
                </Txt>
              </Txt>
              <PercentDelta value={pf?.deltaPct3M ?? 0} suffix={t("3M", "за 3М")} />
            </View>
          </View>
          <View style={{ width: 1, alignSelf: "stretch", backgroundColor: colors.hairline }} />
          <View style={{ flex: 1 }}>
            <Txt color={colors.ink3} size={fontSize.mini}>
              {t("P&L (total)", "P&L (общий)")}
            </Txt>
            <Txt
              color={(pf?.pl ?? 0) >= 0 ? colors.up : colors.down}
              size={22}
              weight="600"
              mono
              style={{ marginTop: 4 }}
            >
              {(pf?.pl ?? 0) >= 0 ? "+" : "−"}
              {fmtMoneyCompact(Math.abs(pf?.pl ?? 0))} {baseSym()}
            </Txt>
          </View>
        </View>

        {/* P&L chart — Total / по сделкам ────────────────── */}
        <PortfolioChart
          series={pf?.pnlSeries ?? []}
          markers={pf?.tradeMarkers ?? []}
          positions={pf?.positions ?? []}
        />

        {/* Positions ───────────────────────────────────── */}
        <SectionHeader
          title={t("Positions", "Позиции")}
          sub={t(`${positions.length} of ${pf?.positions.length ?? 0}`, `${positions.length} из ${pf?.positions.length ?? 0}`)}
          right={
            <Tabs<ClassFilter>
              value={classFilter}
              onChange={setClassFilter}
              options={[
                { key: "all", label: t("All", "Все"), count: counts.all },
                { key: "tradfi", label: t("TradFi", "Трад. финансы"), count: counts.tradfi },
                { key: "crypto", label: t("Crypto", "Крипта"), count: counts.crypto },
                { key: "fiat", label: t("Currencies", "Валюты"), count: counts.fiat },
              ]}
            />
          }
        />

        <Card padded={false} style={{ marginBottom: 28 }}>
          {isDesktop ? (
            <PositionsTable positions={positions} />
          ) : (
            <PositionsList positions={positions} />
          )}
          {positions.length === 0 ? (
            <View style={{ padding: 28, alignItems: "center" }}>
              <Txt color={colors.ink3} size={fontSize.body}>
                {t("No positions in this class yet", "В этом классе пока нет позиций")}
              </Txt>
            </View>
          ) : null}
        </Card>

        {/* Plans (future transactions) — над сделками ── */}
        <SectionHeader
          title={t("Plans", "Планы")}
          sub={String(plans.length)}
          right={
            <Button
              size="sm"
              label={t("Plan", "План")}
              icon={<Feather name="plus" size={14} color={colors.ink} />}
              onPress={() => openAddPlan(portfolioId)}
            />
          }
        />
        <Card padded={false}>
          {plans.length === 0 ? (
            <View style={{ padding: 24, alignItems: "center" }}>
              <Txt color={colors.ink3} size={fontSize.body}>
                {t("No plans — future trades you intend to make", "Планов нет — будущие сделки, которые вы собираетесь провести")}
              </Txt>
            </View>
          ) : (
            plans.map((p: Plan) => (
              <PlanRow
                key={p.id}
                plan={p}
                executing={execPlan.isPending}
                onExecute={() => execPlan.mutate(p.id)}
                onEdit={() => openEditPlan(p)}
                onDelete={() => delPlan.mutate(p.id)}
              />
            ))
          )}
        </Card>

        {/* Transactions ─────────────────────────────── */}
        <View style={{ height: 28 }} />
        <SectionHeader
          title={t("Transactions", "Сделки")}
          sub={String(txs.length)}
          right={
            <Button
              size="sm"
              label={t("Transaction", "Сделка")}
              icon={<Feather name="plus" size={14} color={colors.ink} />}
              onPress={() => openAddTx(portfolioId)}
            />
          }
        />
        <Card padded={false}>
          {txs.length === 0 ? (
            <View style={{ padding: 24, alignItems: "center" }}>
              <Txt color={colors.ink3} size={fontSize.body}>
                {t("No transactions yet", "Сделок пока нет")}
              </Txt>
            </View>
          ) : (
            txs
              .slice(0, txLimit)
              .map((t: import("@/shared/api/types").Transaction) => (
                <TxRow key={t.id} tx={t} onPress={() => openEditTx(t)} />
              ))
          )}
          {txLimit < txs.length ? (
            <Pressable
              onPress={() => setTxLimit((n) => n + 8)}
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
                  · {Math.min(8, txs.length - txLimit)} {t("of", "из")} {txs.length - txLimit}
                </Txt>
              </View>
            </Pressable>
          ) : null}
          {txLimit >= txs.length && txLimit > 8 ? (
            <Pressable
              onPress={() => setTxLimit(8)}
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
    </ScrollView>
  );
}

/** Денежный P&L со знаком и цветом. suffix — символ валюты (по умолч. базовая). */
function PlMoney({
  value,
  size = fontSize.body,
  suffix,
}: {
  value: number;
  size?: number;
  suffix?: string;
}) {
  const c = value > 0 ? colors.up : value < 0 ? colors.down : colors.ink3;
  return (
    <Txt color={c} size={size} weight="500" mono>
      {value > 0 ? "+" : value < 0 ? "−" : ""}
      {fmtMoney(Math.abs(value))} {suffix ?? baseSym()}
    </Txt>
  );
}

/** Символ/тикер валюты `from` пары для колонки Asset P&L. */
function fromSym(id: string): string {
  return id === "RUB" ? "₽" : id === "USD" ? "$" : id === "EUR" ? "€" : id;
}

/** Вертикальный разделитель групп колонок. */
function ColSep() {
  return (
    <View style={{ width: 17, alignItems: "center" }}>
      <View style={{ width: 1, height: 30, backgroundColor: colors.hairline }} />
    </View>
  );
}

/**
 * Desktop table — торговая таблица:
 *   Актив | Вложено · Кол-во ∣ Ср.покупки · Ср.продажи ∣ Цена · Стоимость/доля · План.P&L · P&L
 */
function PositionsTable({ positions }: { positions: Position[] }) {
  const W = {
    asset: 168,
    invested: 92,
    qty: 96,
    avgBuy: 96,
    avgSell: 96,
    price: 92,
    value: 150,
    planned: 108,
    assetPl: 116,
    pl: 108,
  };

  const Head = ({ w, label, left }: { w: number; label: string; left?: boolean }) => (
    <View style={{ width: w, alignItems: left ? "flex-start" : "flex-end" }}>
      <Txt
        color={colors.ink3}
        size={fontSize.mini}
        weight="500"
        style={{ textTransform: "uppercase", letterSpacing: 0.5 }}
      >
        {label}
      </Txt>
    </View>
  );

  return (
    <View>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: 18,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: colors.hairline,
          backgroundColor: colors.surface,
        }}
      >
        <Head w={W.asset} label={t("Asset", "Актив")} left />
        <Head w={W.invested} label={t("INVESTED", "Вложено")} />
        <Head w={W.qty} label={t("QTY", "Кол-во")} />
        <ColSep />
        <Head w={W.avgBuy} label={t("AVG BUY", "Ср. покупки")} />
        <Head w={W.avgSell} label={t("AVG SELL", "Ср. продажи")} />
        <ColSep />
        <Head w={W.price} label={t("PRICE", "Цена")} />
        <Head w={W.value} label={t("VALUE / SHARE", "Стоимость / доля")} />
        <Head w={W.planned} label={t("PLANNED P&L", "План. P&L")} />
        <Head w={W.assetPl} label={t("ASSET P&L", "P&L В FROM")} />
        <Head w={W.pl} label="P&L" />
      </View>
      {/* Rows */}
      {positions.map((p, i) => (
        <View
          key={i}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 18,
            paddingVertical: 10,
            borderBottomWidth: i === positions.length - 1 ? 0 : 1,
            borderBottomColor: colors.hairline2,
            minHeight: 52,
            opacity: p.closed ? 0.55 : 1,
          }}
        >
          {/* Position pair from→to #id */}
          <View style={{ width: W.asset, flexDirection: "row", alignItems: "center", gap: 10 }}>
            <AssetIcon id={p.to.id} size={32} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Txt size={fontSize.body} weight="500" numberOfLines={1}>
                  {p.from.id} → {p.to.id}
                </Txt>
                <Txt color={colors.ink3} size={fontSize.mini} mono>
                  #{p.seq}
                </Txt>
              </View>
              <Txt color={colors.ink3} size={fontSize.mini} numberOfLines={1}>
                {p.closed
                  ? p.redeployed
                    ? t("redeployed", "переложена")
                    : t("closed", "закрыта")
                  : p.to.name}
              </Txt>
            </View>
          </View>
          {/* Invested ₽ */}
          <View style={{ width: W.invested, alignItems: "flex-end" }}>
            <Txt size={fontSize.body} mono>
              {fmtMoney(p.costBase)} {baseSym()}
            </Txt>
          </View>
          {/* Qty held */}
          <View style={{ width: W.qty, alignItems: "flex-end" }}>
            <Txt size={fontSize.body} mono>
              {p.closed ? "—" : fmtQty(p.qty)}
            </Txt>
          </View>
          <ColSep />
          {/* Avg BUY */}
          <View style={{ width: W.avgBuy, alignItems: "flex-end" }}>
            <Txt size={fontSize.body} mono>
              {p.avgPrice > 0 ? `${fmtUnit(p.avgPrice)} ${baseSym()}` : "—"}
            </Txt>
          </View>
          {/* Avg SELL — прочерк, если продаж не было */}
          <View style={{ width: W.avgSell, alignItems: "flex-end" }}>
            <Txt size={fontSize.body} mono color={p.avgClose > 0 ? colors.ink : colors.ink3}>
              {p.avgClose > 0 ? `${fmtUnit(p.avgClose)} ${baseSym()}` : "—"}
            </Txt>
          </View>
          <ColSep />
          {/* Current price (₽/ед.) */}
          <View style={{ width: W.price, alignItems: "flex-end" }}>
            <Txt size={fontSize.body} mono>
              {p.to.id === "RUB" || p.qty === 0
                ? "—"
                : `${fmtUnit(p.valBase / p.qty)} ${baseSym()}`}
            </Txt>
          </View>
          {/* Value + share (доля от суммы позиций) */}
          <View style={{ width: W.value, alignItems: "flex-end", gap: 4 }}>
            <Txt size={fontSize.body} weight="500" mono>
              {fmtMoney(p.valBase)} {baseSym()}
            </Txt>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View
                style={{
                  width: 44,
                  height: 4,
                  backgroundColor: colors.surface3,
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    height: "100%",
                    width: `${Math.min(100, p.share * 100)}%`,
                    backgroundColor: colors.ink3,
                  }}
                />
              </View>
              <Txt color={colors.ink3} size={fontSize.mini} mono>
                {(p.share * 100).toFixed(1).replace(".", ",")}%
              </Txt>
            </View>
          </View>
          {/* Planned P&L (если исполнить планы) */}
          <View style={{ width: W.planned, alignItems: "flex-end" }}>
            <PlMoney value={p.plannedPl} />
          </View>
          {/* Asset P&L — в валюте `from` пары */}
          <View style={{ width: W.assetPl, alignItems: "flex-end" }}>
            <PlMoney value={p.assetPl} suffix={fromSym(p.from.id)} />
          </View>
          {/* P&L ₽ + % */}
          <View style={{ width: W.pl, alignItems: "flex-end", gap: 2 }}>
            <PlMoney value={p.pl} />
            <PercentDelta value={p.plPct} size={fontSize.mini} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Mobile fallback: positions as card-list. */
function PositionsList({ positions }: { positions: Position[] }) {
  return (
    <View>
      {positions.map((p, i) => (
        <Pressable
          key={i}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderBottomWidth: i === positions.length - 1 ? 0 : 1,
            borderBottomColor: colors.hairline2,
            opacity: p.closed ? 0.55 : 1,
          }}
        >
          <AssetIcon id={p.to.id} size={36} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt size={fontSize.body} weight="600" numberOfLines={1}>
              {p.from.id} → {p.to.id} <Txt color={colors.ink3} size={fontSize.mini} mono>#{p.seq}</Txt>
            </Txt>
            <Txt color={colors.ink3} size={fontSize.mini} numberOfLines={1}>
              {p.closed
                ? p.redeployed
                  ? t("redeployed", "переложена")
                  : t("closed", "закрыта")
                : p.to.name}
            </Txt>
          </View>
          <View style={{ alignItems: "flex-end", gap: 2 }}>
            <Txt size={fontSize.body} weight="500" mono>
              {fmtMoney(p.valBase)} {baseSym()}
            </Txt>
            <PlMoney value={p.pl} size={fontSize.mini} />
          </View>
        </Pressable>
      ))}
    </View>
  );
}
