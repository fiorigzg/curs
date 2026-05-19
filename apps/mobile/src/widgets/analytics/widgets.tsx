/**
 * Реестр виджетов Analytics — 1-в-1 с `analytics.jsx :: WIDGETS`.
 * Сейчас реализованы 8 default + 2 community-ready (vol, calmar).
 * Stage 5 добавит frontier/montecarlo/correlation/corr-pairs/monthly/risk-метрики.
 */
import type { ReactNode } from "react";
import { useState } from "react";
import { View } from "react-native";

import {
  useAnalyticsMetrics,
  useByClass,
  useMetrics,
  useSeries,
  useStructure,
} from "@/shared/api/hooks";
import type { Range, RecalcSection } from "@/shared/api/types";
import { t } from "@/shared/config/i18n";
import { classColor, classLabel, colors, fontSize, letterSpacing } from "@/shared/config/theme";
import { baseSym, fmtDateShort, fmtMoneyCompact, fmtPct, rangeLabel } from "@/shared/lib/format";
import { Donut, LineAreaChart, PercentDelta, Tabs, Treemap, Txt } from "@/shared/ui";

import {
  CorrelationHeatmap,
  MonteCarloFan,
  PairwiseTable,
  ScatterLineChart,
  StressBars,
} from "./charts";
import { RecalcButton } from "./RecalcButton";

export type WidgetSize = "xs" | "sm" | "md" | "lg" | "full";

export interface WidgetCtx {
  portfolioId: string;
  range: Range;
}

export interface WidgetDef {
  title: string;
  sub: string;
  size: WidgetSize;
  official: boolean;
  glyph: string;
  color: string;
  author?: string;
  installs?: string;
  render: (ctx: WidgetCtx) => ReactNode;
}

/** Базовый KPI-tile (CURS_ANALYTICS::KpiCard). */
function KpiCard({
  label,
  value,
  sub,
  delta,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: number;
  tone?: "up" | "down";
}) {
  const valueColor = tone === "up" ? colors.up : tone === "down" ? colors.down : colors.ink;
  return (
    <View style={{ gap: 6 }}>
      <Txt
        color={colors.ink3}
        size={fontSize.sub}
        weight="500"
        style={{ textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}
      >
        {label}
      </Txt>
      <Txt color={valueColor} size={24} weight="600" mono style={{ letterSpacing: letterSpacing.metric }}>
        {value}
      </Txt>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 6,
        }}
      >
        {sub ? (
          <Txt color={colors.ink3} size={fontSize.mini}>
            {sub}
          </Txt>
        ) : <View />}
        {delta !== undefined ? <PercentDelta value={delta} size={fontSize.sub} withArrow={false} /> : null}
      </View>
    </View>
  );
}

const pct = (v?: number, decimals = 1) =>
  ((v ?? 0) * 100).toFixed(decimals).replace(".", ",") + "%";

const fixed = (v?: number, decimals = 2) =>
  (v ?? 0).toFixed(decimals);

// ─────────────────── KPI ───────────────────
function KpiValue({ portfolioId, range }: WidgetCtx) {
  const metrics = useMetrics(portfolioId, range);
  const series = useSeries(portfolioId, range);
  const data = series.data;
  const start = data && data.length ? data[0].v : 0;
  const end = data && data.length ? data[data.length - 1].v : 0;
  const delta = start > 0 ? (end - start) / start : 0;
  return (
    <KpiCard
      label={t("Value", "Стоимость")}
      value={`${fmtMoneyCompact(end)} ${baseSym()}`}
      delta={delta}
      sub={t(rangeLabel(range), `за ${rangeLabel(range)}`)}
    />
  );
}

function KpiPl({ portfolioId, range }: WidgetCtx) {
  // PL берём из portfolios detail — но дешевле через metrics? У нас нет endpoint'а pl per range, используем series.
  const series = useSeries(portfolioId, range);
  const data = series.data;
  const pl = data && data.length ? data[data.length - 1].v - data[0].v : 0;
  const plPct = data && data.length && data[0].v ? pl / data[0].v : 0;
  return (
    <KpiCard
      label={t("P&L total", "P&L всего")}
      value={`${pl >= 0 ? "+" : "−"}${fmtMoneyCompact(Math.abs(pl))} ${baseSym()}`}
      delta={plPct}
      tone={pl >= 0 ? "up" : "down"}
    />
  );
}

function KpiSharpe({ portfolioId, range }: WidgetCtx) {
  const m = useMetrics(portfolioId, range);
  return <KpiCard label="Sharpe" value={fixed(m.data?.sharpe)} sub="(R−7%)/σ" />;
}
function KpiMaxDd({ portfolioId, range }: WidgetCtx) {
  const m = useMetrics(portfolioId, range);
  return <KpiCard label="Max DD" value={pct(m.data?.maxDd)} sub={t("over period", "за период")} tone="down" />;
}
function KpiCagr({ portfolioId, range }: WidgetCtx) {
  const m = useMetrics(portfolioId, range);
  return (
    <KpiCard
      label="CAGR"
      value={pct(m.data?.cagr)}
      sub={t("annualized", "годовая")}
      tone={(m.data?.cagr ?? 0) >= 0 ? "up" : "down"}
    />
  );
}
function KpiVol({ portfolioId, range }: WidgetCtx) {
  const m = useMetrics(portfolioId, range);
  return <KpiCard label={t("Volatility", "Волатильность")} value={pct(m.data?.vol)} sub={t("annualized", "годовая")} />;
}
function KpiCalmar({ portfolioId, range }: WidgetCtx) {
  const m = useMetrics(portfolioId, range);
  return <KpiCard label="Calmar" value={fixed(m.data?.calmar)} sub="ret/MaxDD" />;
}

// ─────────────────── Charts ───────────────────
function EquityWidget({ portfolioId, range }: WidgetCtx) {
  const series = useSeries(portfolioId, range);
  const m = useMetrics(portfolioId, range);
  const data = series.data ?? [];
  const start = data[0]?.v ?? 0;
  const end = data[data.length - 1]?.v ?? 0;
  const delta = end - start;
  const deltaPct = start > 0 ? delta / start : 0;
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ gap: 4 }}>
          <Txt
            color={colors.ink3}
            size={fontSize.mini}
            weight="500"
            style={{ textTransform: "uppercase", letterSpacing: 0.6 }}
          >
            {t("Portfolio value", "Стоимость портфеля")}
          </Txt>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10 }}>
            <Txt size={28} weight="600" mono style={{ letterSpacing: letterSpacing.metric }}>
              {fmtMoneyCompact(end)}
              <Txt color={colors.ink3} size={14}>
                {" "}
                {baseSym()}
              </Txt>
            </Txt>
            <PercentDelta value={deltaPct} abs={delta} suffix={t(rangeLabel(range), `за ${rangeLabel(range)}`)} />
          </View>
        </View>
      </View>
      <LineAreaChart series={data} height={280} />
      <View
        style={{
          flexDirection: "row",
          gap: 14,
          marginTop: 6,
          alignItems: "center",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 14, height: 2, backgroundColor: colors.ink }} />
          <Txt color={colors.ink3} size={fontSize.mini}>
            {t("Portfolio", "Портфель")}
          </Txt>
        </View>
        <View style={{ marginLeft: "auto" }}>
          <Txt color={colors.ink3} size={fontSize.mini} mono>
            CAGR{" "}
            <Txt color={colors.ink} weight="700" mono>
              {pct(m.data?.cagr)}
            </Txt>
            {"  "}· σ{" "}
            <Txt color={colors.ink} weight="700" mono>
              {pct(m.data?.vol)}
            </Txt>
          </Txt>
        </View>
      </View>
    </View>
  );
}

function StructureWidget({ portfolioId }: WidgetCtx) {
  const structure = useStructure(portfolioId);
  return (
    <View>
      <Txt size={fontSize.sectionTitleLg} weight="600" style={{ marginBottom: 14 }}>
        {t("Portfolio structure", "Структура портфеля")}
      </Txt>
      <Treemap items={structure.data ?? []} height={300} />
    </View>
  );
}

function ClassesWidget({ portfolioId }: WidgetCtx) {
  const byClass = useByClass(portfolioId);
  const items = byClass.data ?? [];
  return (
    <View>
      <Txt size={fontSize.sectionTitleLg} weight="600" style={{ marginBottom: 14 }}>
        {t("By class", "По классам")}
      </Txt>
      <View style={{ flexDirection: "row", gap: 18, alignItems: "center" }}>
        <Donut items={items} size={140} thickness={20} />
        <View style={{ flex: 1, gap: 10 }}>
          {items.map((it: { class: string; share: number; value: number }, i: number) => (
            <View
              key={i}
              style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    backgroundColor: classColor[it.class],
                  }}
                />
                <Txt size={fontSize.body} weight="500">
                  {classLabel(it.class)}
                </Txt>
              </View>
              <Txt size={fontSize.sub} mono weight="500">
                {(it.share * 100).toFixed(1).replace(".", ",")}%
              </Txt>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function DrawdownWidget({ portfolioId, range }: WidgetCtx) {
  const series = useSeries(portfolioId, range);
  // Простая drawdown-визуализация: точечный плот по running peak вниз.
  // Используем LineAreaChart, оборачивая отрицательную просадку.
  const arr: { d: string; v: number }[] = series.data ?? [];
  const dd: { d: string; v: number }[] = [];
  let peak = 0;
  for (const pt of arr) {
    if (pt.v > peak) peak = pt.v;
    dd.push({ d: pt.d, v: peak > 0 ? (pt.v - peak) / peak : 0 });
  }
  return (
    <View>
      <Txt size={fontSize.sectionTitleLg} weight="600" style={{ marginBottom: 14 }}>
        {t("Drawdown", "Просадка")}
      </Txt>
      <LineAreaChart series={dd} height={180} color={colors.down} />
    </View>
  );
}

// ─────────────────── Risk analytics (Stage 5) ───────────────────
/** Шапка виджета аналитики: заголовок + время расчёта + кнопка «Пересчитать». */
function WidgetHead({
  title,
  portfolioId,
  sections,
  computedAt,
}: {
  title: string;
  portfolioId: string;
  sections: RecalcSection[];
  computedAt?: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
        gap: 8,
      }}
    >
      <View style={{ flex: 1 }}>
        <Txt size={fontSize.sectionTitleLg} weight="600">
          {title}
        </Txt>
        {computedAt ? (
          <Txt size={fontSize.micro} color={colors.ink3}>
            {t("computed", "рассчитано")} {fmtDateShort(computedAt)}
          </Txt>
        ) : null}
      </View>
      <RecalcButton portfolioId={portfolioId} sections={sections} />
    </View>
  );
}

function Insufficient({ note }: { note?: string }) {
  return (
    <View style={{ height: 120, alignItems: "center", justifyContent: "center" }}>
      <Txt size={fontSize.mini} color={colors.ink3}>
        {note || t("Not enough data for this metric", "Недостаточно данных для метрики")}
      </Txt>
    </View>
  );
}

const pctTick = (v: number) => fmtPct(v, { sign: false, decimals: 0 });

function SmlWidget({ portfolioId }: WidgetCtx) {
  const m = useAnalyticsMetrics(portfolioId);
  const env = m.data?.sections.capm;
  const capm = env?.payload;
  const sml = capm?.sml;
  const points: { x: number; y: number; label?: string; color?: string; highlight?: boolean }[] =
    (sml?.points ?? []).map((p) => ({ ...p, color: colors.accent3 }));
  if (sml?.market) {
    points.push({
      x: sml.market.beta,
      y: sml.market.annReturn,
      label: t("Market", "Рынок"),
      color: colors.ink,
      highlight: true,
    });
  }
  const lines = sml ? [{ intercept: sml.line.intercept, slope: sml.line.slope, color: colors.ink3 }] : [];
  return (
    <View>
      <WidgetHead
        title={t("SML — security market line", "SML — линия рынка бумаг")}
        portfolioId={portfolioId}
        sections={["per_asset", "capm"]}
        computedAt={env?.computedAt}
      />
      {!capm || capm.insufficientData ? (
        <Insufficient note={capm?.note} />
      ) : (
        <ScatterLineChart
          points={points}
          lines={lines}
          xTitle={t("Beta β", "Бета β")}
          yTitle={t("E(r), annual", "E(r), год.")}
          fmtX={(v) => v.toFixed(2)}
          fmtY={pctTick}
        />
      )}
    </View>
  );
}

function CmlWidget({ portfolioId }: WidgetCtx) {
  const m = useAnalyticsMetrics(portfolioId);
  const capmEnv = m.data?.sections.capm;
  const optEnv = m.data?.sections.optimization;
  const cml = capmEnv?.payload?.cml;
  const opt = optEnv?.payload;
  const points: { x: number; y: number; label?: string; color?: string; highlight?: boolean }[] = [];
  // Эффективная граница — бледные точки.
  for (const p of opt?.frontier ?? []) points.push({ x: p.risk, y: p.ret, color: colors.ink4 });
  // Активы — подписанные точки.
  for (const a of cml?.assets ?? []) points.push({ x: a.x, y: a.y, label: a.label, color: colors.accent3 });
  // Касательный портфель — выделенная точка.
  const tan = cml?.tangency ?? opt?.tangency;
  if (tan) points.push({ x: tan.risk, y: tan.ret, label: t("Tangency", "Касательный"), color: colors.up, highlight: true });
  const lines = cml ? [{ intercept: cml.line.intercept, slope: cml.line.slope, color: colors.ink }] : [];
  return (
    <View>
      <WidgetHead
        title={t("CML & efficient frontier", "CML и эффективная граница")}
        portfolioId={portfolioId}
        sections={["capm", "optimization"]}
        computedAt={optEnv?.computedAt ?? capmEnv?.computedAt}
      />
      {!cml && !opt?.frontier?.length ? (
        <Insufficient note={capmEnv?.payload?.note ?? optEnv?.payload?.note} />
      ) : (
        <ScatterLineChart
          points={points}
          lines={lines}
          xTitle={t("Risk σ, annual", "Риск σ, год.")}
          yTitle={t("E(r), annual", "E(r), год.")}
          fmtX={pctTick}
          fmtY={pctTick}
        />
      )}
    </View>
  );
}

function CorrelationWidget({ portfolioId }: WidgetCtx) {
  const m = useAnalyticsMetrics(portfolioId);
  const env = m.data?.sections.correlation;
  const corr = env?.payload;
  return (
    <View>
      <WidgetHead
        title={t("Correlation matrix", "Матрица корреляций")}
        portfolioId={portfolioId}
        sections={["correlation"]}
        computedAt={env?.computedAt}
      />
      {!corr || corr.insufficientData ? (
        <Insufficient note={corr?.note} />
      ) : (
        <CorrelationHeatmap labels={corr.labels} matrix={corr.matrix} />
      )}
    </View>
  );
}

function PairwiseWidget({ portfolioId }: WidgetCtx) {
  const m = useAnalyticsMetrics(portfolioId);
  const env = m.data?.sections.pairwise;
  const pw = env?.payload;
  return (
    <View>
      <WidgetHead
        title={t("Pairwise metrics", "Попарные метрики")}
        portfolioId={portfolioId}
        sections={["pairwise"]}
        computedAt={env?.computedAt}
      />
      {!pw || pw.insufficientData ? (
        <Insufficient note={pw?.note} />
      ) : (
        <PairwiseTable pairs={pw.pairs} />
      )}
    </View>
  );
}

function StressWidget({ portfolioId }: WidgetCtx) {
  const m = useAnalyticsMetrics(portfolioId);
  const env = m.data?.sections.risk;
  const risk = env?.payload;
  return (
    <View>
      <WidgetHead
        title={t("Market stress test", "Стресс-тест рынка")}
        portfolioId={portfolioId}
        sections={["per_asset", "risk"]}
        computedAt={env?.computedAt}
      />
      {!risk || risk.insufficientData ? (
        <Insufficient note={risk?.note} />
      ) : (
        <StressBars scenarios={risk.scenarios} betaP={risk.betaP} />
      )}
    </View>
  );
}

function MonteCarloWidget({ portfolioId }: WidgetCtx) {
  const m = useAnalyticsMetrics(portfolioId);
  const env = m.data?.sections.monte_carlo;
  const mc = env?.payload;
  const [method, setMethod] = useState<"parametric" | "bootstrap">("parametric");
  const run = method === "parametric" ? mc?.parametric : mc?.bootstrap;
  return (
    <View>
      <WidgetHead
        title={t("Monte Carlo forecast", "Monte Carlo прогноз")}
        portfolioId={portfolioId}
        sections={["monte_carlo"]}
        computedAt={env?.computedAt}
      />
      {!mc || mc.insufficientData ? (
        <Insufficient note={mc?.note} />
      ) : (
        <>
          <View style={{ alignSelf: "flex-start", marginBottom: 10 }}>
            <Tabs<"parametric" | "bootstrap">
              value={method}
              options={[
                { key: "parametric", label: t("Parametric", "Параметрический") },
                { key: "bootstrap", label: t("Bootstrap", "Бутстрэп") },
              ]}
              onChange={setMethod}
            />
          </View>
          <MonteCarloFan run={run} />
        </>
      )}
    </View>
  );
}

// ─────────────────── Registry ───────────────────
// Функция, а не const: title/sub (t()) и color (тема) должны вычисляться
// в рендере, иначе заморозятся на языке/теме момента импорта модуля.
export function buildWidgets(): Record<string, WidgetDef> {
  return {
  "kpi-value": {
    title: t("Portfolio value", "Стоимость портфеля"),
    sub: t("Current total value and change over the period.", "Текущая суммарная стоимость и изменение за период."),
    size: "xs", official: true, glyph: baseSym(), color: colors.ink,
    render: (ctx) => <KpiValue {...ctx} />,
  },
  "kpi-pl": {
    title: t("P&L total", "P&L всего"),
    sub: t("Unrealized profit/loss since purchases.", "Нереализованная прибыль/убыток с момента покупок."),
    size: "xs", official: true, glyph: "±", color: colors.up,
    render: (ctx) => <KpiPl {...ctx} />,
  },
  "kpi-sharpe": {
    title: "Sharpe Ratio",
    sub: t("Return relative to the risk-free rate, divided by risk.", "Доходность относительно безрисковой ставки, делённая на риск."),
    size: "xs", official: true, glyph: "S", color: "#4F6BED",
    render: (ctx) => <KpiSharpe {...ctx} />,
  },
  "kpi-maxdd": {
    title: "Max Drawdown",
    sub: t("Largest drawdown from peak over the period.", "Наибольшая просадка от пика за период."),
    size: "xs", official: true, glyph: "↓", color: colors.down,
    render: (ctx) => <KpiMaxDd {...ctx} />,
  },
  "kpi-cagr": {
    title: "CAGR",
    sub: t("Average annual portfolio return.", "Среднегодовая доходность портфеля."),
    size: "xs", official: true, glyph: "∡", color: "#1F8F6F",
    render: (ctx) => <KpiCagr {...ctx} />,
  },
  "kpi-vol": {
    title: t("Volatility", "Волатильность"),
    sub: t("Annualized standard deviation of returns.", "Годовое стандартное отклонение доходности."),
    size: "xs", official: false, author: "@quant_ru", installs: "1.2k", glyph: "σ", color: "#B58300",
    render: (ctx) => <KpiVol {...ctx} />,
  },
  "kpi-calmar": {
    title: "Calmar Ratio",
    sub: t("Annual return ÷ max drawdown.", "Годовая доходность ÷ max просадка."),
    size: "xs", official: false, author: "@riskmodel", installs: "480", glyph: "C", color: "#8C5BD7",
    render: (ctx) => <KpiCalmar {...ctx} />,
  },
  equity: {
    title: t("Value and benchmark", "Стоимость и бенчмарк"),
    sub: t("Portfolio dynamics.", "Динамика портфеля."),
    size: "full", official: true, glyph: "◢", color: colors.ink,
    render: (ctx) => <EquityWidget {...ctx} />,
  },
  structure: {
    title: t("Portfolio structure", "Структура портфеля"),
    sub: t("Treemap of positions by portfolio weight.", "Treemap позиций по доле в портфеле."),
    size: "md", official: true, glyph: "▦", color: "#2F4858",
    render: (ctx) => <StructureWidget {...ctx} />,
  },
  classes: {
    title: t("By asset class", "По классам активов"),
    sub: t("Allocation across TradFi, crypto and currencies.", "Распределение между трад. финансами, криптой и валютами."),
    size: "md", official: true, glyph: "◐", color: "#86B0A0",
    render: (ctx) => <ClassesWidget {...ctx} />,
  },
  drawdown: {
    title: t("Drawdown", "Просадка"),
    sub: t("Depth and duration of drawdowns from peak.", "Глубина и длительность просадок от пика."),
    size: "full", official: true, glyph: "↘", color: colors.down,
    render: (ctx) => <DrawdownWidget {...ctx} />,
  },
  sml: {
    title: t("SML (CAPM)", "SML (CAPM)"),
    sub: t("Assets as points, security market line.", "Активы точками, линия рынка ценных бумаг."),
    size: "md", official: true, glyph: "β", color: "#4F6BED",
    render: (ctx) => <SmlWidget {...ctx} />,
  },
  cml: {
    title: t("CML & frontier", "CML и граница"),
    sub: t("Efficient frontier with tangency portfolio.", "Эффективная граница с касательным портфелем."),
    size: "md", official: true, glyph: "◹", color: "#1F8F6F",
    render: (ctx) => <CmlWidget {...ctx} />,
  },
  correlation: {
    title: t("Correlation matrix", "Матрица корреляций"),
    sub: t("Pearson correlation of daily returns.", "Корреляция Пирсона дневных доходностей."),
    size: "md", official: true, glyph: "▦", color: "#8C5BD7",
    render: (ctx) => <CorrelationWidget {...ctx} />,
  },
  pairwise: {
    title: t("Pairwise metrics", "Попарные метрики"),
    sub: t("Pair regression, optimization, hedge ratio.", "Парная регрессия, оптимизация, hedge ratio."),
    size: "md", official: true, glyph: "⇄", color: "#B58300",
    render: (ctx) => <PairwiseWidget {...ctx} />,
  },
  stress: {
    title: t("Market stress test", "Стресс-тест рынка"),
    sub: t("Portfolio drop on market shocks.", "Падение портфеля при рыночных шоках."),
    size: "md", official: true, glyph: "↯", color: colors.down,
    render: (ctx) => <StressWidget {...ctx} />,
  },
  montecarlo: {
    title: t("Monte Carlo", "Monte Carlo"),
    sub: t("Forecast distribution, VaR/CVaR.", "Распределение прогноза, VaR/CVaR."),
    size: "full", official: true, glyph: "∿", color: "#4F6BED",
    render: (ctx) => <MonteCarloWidget {...ctx} />,
  },
  };
}

export const DEFAULT_LAYOUT = [
  "kpi-value",
  "kpi-pl",
  "kpi-sharpe",
  "kpi-maxdd",
  "equity",
  "structure",
  "classes",
  "drawdown",
  "sml",
  "cml",
  "correlation",
  "pairwise",
  "stress",
  "montecarlo",
];
