/**
 * Графики риск-аналитики на @shopify/react-native-skia (без новых chart-библиотек).
 * Подписи осей/легенды/тултипы — на русском. Точки и линии рисуются в Skia,
 * текстовые метки — наложением RN <Txt> (Skia Text требует объектов шрифта).
 */
import { Canvas, Circle, Path, Skia } from "@shopify/react-native-skia";
import { useState } from "react";
import { Pressable, View } from "react-native";

import type {
  McRun,
  PairwiseSummaryItem,
  StressScenario,
  XYPoint,
} from "@/shared/api/types";
import { t } from "@/shared/config/i18n";
import { colors, fontSize } from "@/shared/config/theme";
import { fmtMoneyCompact, fmtPct } from "@/shared/lib/format";
import { Txt } from "@/shared/ui";

// ─────────────────────────── общее ───────────────────────────
function useWidth(initial = 320): [number, (w: number) => void] {
  const [w, setW] = useState(initial);
  return [w, setW];
}

const PAD = { left: 44, right: 14, top: 12, bottom: 28 };

interface ChartLine {
  intercept: number;
  slope: number;
  color: string;
}
interface PlotPoint extends XYPoint {
  color?: string;
  highlight?: boolean;
}

function domain(values: number[], padFrac = 0.1): [number, number] {
  if (!values.length) return [0, 1];
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (lo === hi) {
    const d = Math.abs(lo) * 0.5 || 1;
    lo -= d;
    hi += d;
  }
  const pad = (hi - lo) * padFrac;
  return [lo - pad, hi + pad];
}

/** Scatter + линии (для SML и CML). */
export function ScatterLineChart({
  points,
  lines = [],
  height = 240,
  fmtX = (v: number) => v.toFixed(2),
  fmtY = (v: number) => fmtPct(v, { sign: false }),
  xTitle,
  yTitle,
}: {
  points: PlotPoint[];
  lines?: ChartLine[];
  height?: number;
  fmtX?: (v: number) => string;
  fmtY?: (v: number) => string;
  xTitle: string;
  yTitle: string;
}) {
  const [w, setW] = useWidth();
  if (!points.length) {
    return <EmptyPlot height={height} onLayout={setW} />;
  }
  const innerW = Math.max(1, w - PAD.left - PAD.right);
  const innerH = Math.max(1, height - PAD.top - PAD.bottom);

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const [x0, x1] = domain(xs);
  // Учитываем значения линий на краях диапазона для y-домена.
  const lineYs = lines.flatMap((l) => [l.intercept + l.slope * x0, l.intercept + l.slope * x1]);
  const [y0, y1] = domain([...ys, ...lineYs]);

  const sx = (x: number) => PAD.left + ((x - x0) / (x1 - x0)) * innerW;
  const sy = (y: number) => PAD.top + (1 - (y - y0) / (y1 - y0)) * innerH;

  const linePaths = lines.map((l) => {
    const p = Skia.Path.Make();
    p.moveTo(sx(x0), sy(l.intercept + l.slope * x0));
    p.lineTo(sx(x1), sy(l.intercept + l.slope * x1));
    return { path: p, color: l.color };
  });

  return (
    <View style={{ height }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <Canvas style={{ flex: 1 }}>
        {linePaths.map((lp, i) => (
          <Path key={`l${i}`} path={lp.path} style="stroke" strokeWidth={1.5} color={lp.color} />
        ))}
        {points.map((p, i) => (
          <Circle
            key={`p${i}`}
            cx={sx(p.x)}
            cy={sy(p.y)}
            r={p.highlight ? 6 : 4}
            color={p.color ?? colors.ink}
          />
        ))}
      </Canvas>
      {/* Метки точек */}
      {points.map((p, i) => (
        <View
          key={`lbl${i}`}
          style={{ position: "absolute", left: sx(p.x) + 7, top: sy(p.y) - 7 }}
          pointerEvents="none"
        >
          {p.label ? (
            <Txt size={fontSize.micro} mono color={colors.ink3}>
              {p.label}
            </Txt>
          ) : null}
        </View>
      ))}
      {/* Оси: подписи min/max */}
      <Axis x0={x0} x1={x1} y0={y0} y1={y1} fmtX={fmtX} fmtY={fmtY} xTitle={xTitle} yTitle={yTitle} height={height} />
    </View>
  );
}

function Axis({
  x0,
  x1,
  y0,
  y1,
  fmtX,
  fmtY,
  xTitle,
  yTitle,
  height,
}: {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  fmtX: (v: number) => string;
  fmtY: (v: number) => string;
  xTitle: string;
  yTitle: string;
  height: number;
}) {
  const lbl = { color: colors.ink3, size: fontSize.micro } as const;
  return (
    <>
      <View style={{ position: "absolute", left: 2, top: PAD.top - 4 }} pointerEvents="none">
        <Txt {...lbl} mono>{fmtY(y1)}</Txt>
      </View>
      <View style={{ position: "absolute", left: 2, top: height - PAD.bottom - 6 }} pointerEvents="none">
        <Txt {...lbl} mono>{fmtY(y0)}</Txt>
      </View>
      <View style={{ position: "absolute", left: PAD.left, bottom: 8 }} pointerEvents="none">
        <Txt {...lbl} mono>{fmtX(x0)}</Txt>
      </View>
      <View style={{ position: "absolute", right: PAD.right, bottom: 8 }} pointerEvents="none">
        <Txt {...lbl} mono>{fmtX(x1)}</Txt>
      </View>
      <View style={{ position: "absolute", right: PAD.right, bottom: 8, alignSelf: "center", left: 0, alignItems: "center" }} pointerEvents="none">
        <Txt {...lbl}>{xTitle}</Txt>
      </View>
      <View style={{ position: "absolute", left: 2, top: 0 }} pointerEvents="none">
        <Txt {...lbl}>{yTitle}</Txt>
      </View>
    </>
  );
}

function EmptyPlot({ height, onLayout }: { height: number; onLayout: (w: number) => void }) {
  return (
    <View
      style={{ height, alignItems: "center", justifyContent: "center" }}
      onLayout={(e) => onLayout(e.nativeEvent.layout.width)}
    >
      <Txt color={colors.ink3} size={fontSize.mini}>
        {t("No data — recalculate", "Нет данных — выполните пересчёт")}
      </Txt>
    </View>
  );
}

// ─────────────────────────── тепловая карта корреляций ───────────────────────────
function corrColor(v: number): string {
  // −1 → красный, 0 → нейтральный, +1 → зелёный (диверг. шкала).
  const a = Math.min(1, Math.abs(v));
  if (v >= 0) return `rgba(76,181,104,${0.12 + 0.7 * a})`;
  return `rgba(225,91,76,${0.12 + 0.7 * a})`;
}

export function CorrelationHeatmap({
  labels = [],
  matrix = [],
}: {
  labels?: string[];
  matrix?: number[][];
}) {
  if (labels.length < 2 || !matrix.length) {
    return <EmptyPlot height={180} onLayout={() => {}} />;
  }
  const n = labels.length;
  const cell = Math.max(22, Math.min(46, Math.floor(300 / n)));
  return (
    <View>
      {/* Заголовки столбцов */}
      <View style={{ flexDirection: "row", marginLeft: 44 }}>
        {labels.map((l) => (
          <View key={l} style={{ width: cell, alignItems: "center" }}>
            <Txt size={fontSize.micro} mono color={colors.ink3}>
              {l}
            </Txt>
          </View>
        ))}
      </View>
      {matrix.map((row, i) => (
        <View key={labels[i]} style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ width: 44 }}>
            <Txt size={fontSize.micro} mono color={colors.ink3}>
              {labels[i]}
            </Txt>
          </View>
          {row.map((v, j) => (
            <View
              key={`${i}-${j}`}
              style={{
                width: cell,
                height: cell,
                backgroundColor: corrColor(v),
                borderWidth: 0.5,
                borderColor: colors.surface,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Txt size={fontSize.micro} mono color={colors.ink2}>
                {v.toFixed(2).replace(".", ",").replace("-", "−")}
              </Txt>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

// ─────────────────────────── таблица попарных метрик ───────────────────────────
type PairwiseSortKey = "r2" | "maxSharpe" | "hedgeReduction" | "rho";

export function PairwiseTable({ pairs = [] }: { pairs?: PairwiseSummaryItem[] }) {
  const [sort, setSort] = useState<PairwiseSortKey>("r2");
  if (!pairs.length) {
    return <EmptyPlot height={120} onLayout={() => {}} />;
  }
  const sorted = [...pairs].sort((a, b) => b[sort] - a[sort]);
  const cols: { key: PairwiseSortKey; label: string }[] = [
    { key: "r2", label: "R²" },
    { key: "maxSharpe", label: "Sharpe" },
    { key: "hedgeReduction", label: t("Hedge", "Хедж σ²") },
    { key: "rho", label: "ρ" },
  ];
  const fmt = (k: PairwiseSortKey, v: number) =>
    k === "maxSharpe" ? v.toFixed(2) : fmtPct(v, { sign: false, decimals: 0 });

  return (
    <View>
      <View style={{ flexDirection: "row", paddingBottom: 6, borderBottomWidth: 1, borderColor: colors.hairline }}>
        <View style={{ flex: 1.4 }}>
          <Txt size={fontSize.micro} color={colors.ink3} weight="600">
            {t("Pair", "Пара")}
          </Txt>
        </View>
        {cols.map((c) => (
          <Pressable key={c.key} style={{ flex: 1, alignItems: "flex-end" }} onPress={() => setSort(c.key)}>
            <Txt size={fontSize.micro} weight={sort === c.key ? "700" : "500"} color={sort === c.key ? colors.ink : colors.ink3}>
              {c.label}
              {sort === c.key ? " ↓" : ""}
            </Txt>
          </Pressable>
        ))}
      </View>
      {sorted.map((p) => (
        <View
          key={`${p.assetA}/${p.assetB}`}
          style={{ flexDirection: "row", paddingVertical: 6, borderBottomWidth: 0.5, borderColor: colors.hairline2 }}
        >
          <View style={{ flex: 1.4 }}>
            <Txt size={fontSize.sub} mono>
              {p.assetA}/{p.assetB}
            </Txt>
          </View>
          {cols.map((c) => (
            <View key={c.key} style={{ flex: 1, alignItems: "flex-end" }}>
              <Txt size={fontSize.sub} mono color={colors.ink2}>
                {fmt(c.key, p[c.key])}
              </Txt>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

// ─────────────────────────── Monte Carlo fan chart ───────────────────────────
export function MonteCarloFan({ run, height = 240 }: { run?: McRun; height?: number }) {
  const [w, setW] = useWidth();
  if (!run || !run.fan?.p50?.length) {
    return <EmptyPlot height={height} onLayout={setW} />;
  }
  const p5 = run.fan.p5;
  const p25 = run.fan.p25;
  const p50 = run.fan.p50;
  const p75 = run.fan.p75;
  const p95 = run.fan.p95;
  const steps = p50.length;
  const innerW = Math.max(1, w - PAD.left - PAD.right);
  const innerH = Math.max(1, height - PAD.top - PAD.bottom);
  const allVals = [...p5, ...p95];
  const [y0, y1] = domain(allVals, 0.05);
  const sx = (i: number) => PAD.left + (i / (steps - 1)) * innerW;
  const sy = (v: number) => PAD.top + (1 - (v - y0) / (y1 - y0)) * innerH;

  const band = (lo: number[], hi: number[]) => {
    const p = Skia.Path.Make();
    p.moveTo(sx(0), sy(hi[0]));
    for (let i = 1; i < steps; i++) p.lineTo(sx(i), sy(hi[i]));
    for (let i = steps - 1; i >= 0; i--) p.lineTo(sx(i), sy(lo[i]));
    p.close();
    return p;
  };
  const median = Skia.Path.Make();
  median.moveTo(sx(0), sy(p50[0]));
  for (let i = 1; i < steps; i++) median.lineTo(sx(i), sy(p50[i]));

  return (
    <View>
      <View style={{ height }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        <Canvas style={{ flex: 1 }}>
          <Path path={band(p5, p95)} color="rgba(79,107,237,0.12)" />
          <Path path={band(p25, p75)} color="rgba(79,107,237,0.22)" />
          <Path path={median} style="stroke" strokeWidth={1.8} color={colors.accent3} />
        </Canvas>
        <View style={{ position: "absolute", left: 2, top: PAD.top - 4 }} pointerEvents="none">
          <Txt size={fontSize.micro} mono color={colors.ink3}>
            {fmtMoneyCompact(y1)}
          </Txt>
        </View>
        <View style={{ position: "absolute", left: 2, top: height - PAD.bottom - 6 }} pointerEvents="none">
          <Txt size={fontSize.micro} mono color={colors.ink3}>
            {fmtMoneyCompact(y0)}
          </Txt>
        </View>
      </View>
      <McStats run={run} />
    </View>
  );
}

function McStats({ run }: { run: McRun }) {
  const cell = (label: string, value: string, tone?: string) => (
    <View style={{ flex: 1, gap: 2 }}>
      <Txt size={fontSize.micro} color={colors.ink3} style={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </Txt>
      <Txt size={fontSize.sub} mono weight="600" color={tone ?? colors.ink}>
        {value}
      </Txt>
    </View>
  );
  return (
    <View style={{ flexDirection: "row", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
      {cell("VaR 95%", fmtPct(-run.var.var95, { sign: false }), colors.down)}
      {cell("VaR 99%", fmtPct(-run.var.var99, { sign: false }), colors.down)}
      {cell("CVaR 95%", fmtPct(-run.cvar.cvar95, { sign: false }), colors.down)}
      {cell(t("Loss prob.", "Вер. убытка"), fmtPct(run.probLoss, { sign: false, decimals: 0 }))}
      {cell(t("Median", "Медиана"), fmtMoneyCompact(run.terminalMedian))}
    </View>
  );
}

// ─────────────────────────── стресс-тест (бары) ───────────────────────────
export function StressBars({ scenarios = [], betaP }: { scenarios?: StressScenario[]; betaP?: number }) {
  if (!scenarios.length) {
    return <EmptyPlot height={140} onLayout={() => {}} />;
  }
  const maxMag = Math.max(
    ...scenarios.flatMap((s) => [Math.abs(s.model), Math.abs(s.empirical ?? 0)]),
    0.01,
  );
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", gap: 14, marginBottom: 2 }}>
        <Legend color={colors.down} label={t("Model (CAPM β)", "Модель (CAPM β)")} />
        <Legend color={colors.warn} label={t("Empirical", "Эмпирика")} />
        {betaP !== undefined ? (
          <Txt size={fontSize.micro} mono color={colors.ink3} style={{ marginLeft: "auto" }}>
            β_p = {betaP.toFixed(2)}
          </Txt>
        ) : null}
      </View>
      {scenarios.map((s) => (
        <View key={s.shock} style={{ gap: 4 }}>
          <Txt size={fontSize.micro} mono color={colors.ink3}>
            {t("Market", "Рынок")} {fmtPct(s.shock, { sign: true, decimals: 0 })}
          </Txt>
          <Bar value={s.model} maxMag={maxMag} color={colors.down} />
          {s.empirical !== null ? (
            <Bar value={s.empirical} maxMag={maxMag} color={colors.warn} />
          ) : (
            <Txt size={fontSize.micro} color={colors.ink4}>
              {t("no empirical days", "нет эмпирических дней")}
            </Txt>
          )}
        </View>
      ))}
    </View>
  );
}

function Bar({ value, maxMag, color }: { value: number; maxMag: number; color: string }) {
  const frac = Math.min(1, Math.abs(value) / maxMag);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ flex: 1, height: 14, backgroundColor: colors.surface2, borderRadius: 4, overflow: "hidden" }}>
        <View style={{ width: `${frac * 100}%`, height: "100%", backgroundColor: color, opacity: 0.85 }} />
      </View>
      <View style={{ width: 56, alignItems: "flex-end" }}>
        <Txt size={fontSize.micro} mono color={colors.ink2}>
          {fmtPct(value, { sign: true })}
        </Txt>
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color }} />
      <Txt size={fontSize.micro} color={colors.ink3}>
        {label}
      </Txt>
    </View>
  );
}
