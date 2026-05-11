/**
 * PortfolioChart — крупный интерактивный график под шапкой портфеля.
 *   Режим «Total»     — кривая суммарного P&L во времени (скраб пальцем/мышью).
 *   Режим «По сделкам» — столбики P&L каждой позиции (тап по столбику).
 * Значения приходят уже в базовой валюте (см. ?ccy=).
 */
import { Canvas, LinearGradient, Path, Skia, vec } from "@shopify/react-native-skia";
import { useState } from "react";
import { Pressable, View } from "react-native";

import type { PointTV, Position, TradeMarker } from "@/shared/api/types";
import { t } from "@/shared/config/i18n";
import { colors, fontSize, radius } from "@/shared/config/theme";
import { baseSym, fmtDateShort, fmtMoney, fmtMoneyCompact, fmtQty } from "@/shared/lib/format";
import { Txt } from "@/shared/ui";

type Mode = "total" | "trades";
const H = 240;

// Маркеры сделок: насыщенные и явно различимые (тёмные up/down-ink сливались).
const BUY_COLOR = "#13A14A"; // покупка — зелёный
const SELL_COLOR = "#E8312A"; // продажа — красный

function signColor(v: number): string {
  return v > 0 ? colors.up : v < 0 ? colors.down : colors.ink3;
}
function signed(v: number): string {
  return (v > 0 ? "+" : v < 0 ? "−" : "") + fmtMoney(Math.abs(v));
}

export function PortfolioChart({
  series,
  markers = [],
  positions,
}: {
  /** P&L по дням от первой транзакции (значения уже в базовой валюте). */
  series: PointTV[];
  /** Точки покупок (зелёные) и продаж (красные) на кривой Total. */
  markers?: TradeMarker[];
  positions: Position[];
}) {
  const [mode, setMode] = useState<Mode>("total");

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.hairline,
        borderRadius: radius.lg,
        padding: 18,
        marginBottom: 28,
      }}
    >
      {/* Header + переключатель режимов */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <Txt color={colors.ink3} size={fontSize.mini} weight="500" style={{ textTransform: "uppercase", letterSpacing: 0.6 }}>
          {mode === "total" ? t("Total P&L over time", "Общий P&L во времени") : t("P&L by trade", "P&L по сделкам")}
        </Txt>
        <View style={{ flexDirection: "row", backgroundColor: colors.surface2, borderRadius: radius.md, padding: 2 }}>
          {(["total", "trades"] as Mode[]).map((m) => (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              style={{
                paddingVertical: 5,
                paddingHorizontal: 12,
                borderRadius: radius.md - 2,
                backgroundColor: mode === m ? colors.surface : "transparent",
              }}
            >
              <Txt color={mode === m ? colors.ink : colors.ink3} size={fontSize.mini} weight="500">
                {m === "total" ? t("Total", "Общий") : t("By trade", "По сделкам")}
              </Txt>
            </Pressable>
          ))}
        </View>
      </View>

      {mode === "total" ? <TotalChart series={series} markers={markers} /> : <TradesChart positions={positions} />}
    </View>
  );
}

/** Кривая P&L во времени (значения уже = P&L) со скрабом + точки сделок. */
function TotalChart({ series, markers }: { series: PointTV[]; markers: TradeMarker[] }) {
  const [w, setW] = useState(640);
  const [sel, setSel] = useState<number | null>(null);

  const pnl = series;
  if (pnl.length < 2) {
    return (
      <View style={{ height: H, alignItems: "center", justifyContent: "center" }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        <Txt color={colors.ink3} size={fontSize.body}>
          {t("Not enough history yet", "Пока недостаточно истории")}
        </Txt>
      </View>
    );
  }

  const vals = pnl.map((p) => p.v);
  const lo = Math.min(0, ...vals);
  const hi = Math.max(0, ...vals);
  const pad = (hi - lo) * 0.12 || 1;
  const yMin = lo - pad;
  const yMax = hi + pad;
  const padT = 18;
  const padB = 22;
  const innerH = H - padT - padB;
  const stepX = w / (pnl.length - 1);
  const X = (i: number) => i * stepX;
  const Y = (v: number) => padT + (1 - (v - yMin) / (yMax - yMin)) * innerH;

  const last = vals[vals.length - 1];
  const color = signColor(last);

  // Сглаженная линия (Catmull-Rom → Безье).
  const pts = pnl.map((p, i) => ({ x: X(i), y: Y(p.v) }));
  const line = Skia.Path.Make();
  line.moveTo(pts[0].x, pts[0].y);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    line.cubicTo(p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6, p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6, p2.x, p2.y);
  }
  const area = line.copy();
  const zeroY = Y(0);
  area.lineTo(pts[pts.length - 1].x, zeroY);
  area.lineTo(pts[0].x, zeroY);
  area.close();

  // Точки сделок: дата → индекс на кривой (тёмно-зелёные покупки / тёмно-красные продажи).
  const idxByDate = new Map(pnl.map((p, i) => [p.d, i]));
  const dots = markers
    .map((m) => ({ i: idxByDate.get(m.d) as number, m }))
    .filter((d) => d.i !== undefined);

  const onTouch = (x: number) => {
    let i = Math.max(0, Math.min(pnl.length - 1, Math.round(x / stepX)));
    // «Магнит» к ближайшей сделке (~7px), чтобы её было легко поймать курсором.
    const snap = Math.max(2, Math.round(7 / stepX));
    let best = -1;
    let bestDist = Infinity;
    for (const d of dots) {
      const dist = Math.abs(d.i - i);
      if (dist <= snap && dist < bestDist) {
        best = d.i;
        bestDist = dist;
      }
    }
    if (best >= 0) i = best;
    setSel(i);
  };
  const cur = sel ?? pnl.length - 1;
  const tradesAtCur = markers.filter((m) => m.d === pnl[cur].d);

  return (
    <View
      style={{ height: H }}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => onTouch(e.nativeEvent.locationX)}
      onResponderMove={(e) => onTouch(e.nativeEvent.locationX)}
    >
      <Canvas style={{ flex: 1 }}>
        <Path path={area}>
          <LinearGradient
            start={vec(0, padT)}
            end={vec(0, zeroY)}
            colors={[color + "33", color + "00"]}
          />
        </Path>
        <Path path={line} style="stroke" strokeWidth={1.8} color={color} strokeJoin="round" strokeCap="round" />
      </Canvas>

      {/* Нулевая линия */}
      <View style={{ position: "absolute", left: 0, right: 0, top: zeroY, height: 1, backgroundColor: colors.hairline }} />

      {/* Точки сделок: тёмно-зелёные — покупки, тёмно-красные — продажи.
          Белое кольцо-ореол отделяет точку от линии; выбранная — крупнее. */}
      {dots.map((d, k) => {
        const c = d.m.kind === "buy" ? BUY_COLOR : SELL_COLOR;
        const active = d.i === cur;
        const s = active ? 18 : 13;
        return (
          <View
            key={`m${k}`}
            pointerEvents="none"
            style={{
              position: "absolute",
              left: X(d.i) - s / 2,
              top: Y(pnl[d.i].v) - s / 2,
              width: s,
              height: s,
              borderRadius: s / 2,
              backgroundColor: c,
              borderWidth: 3,
              borderColor: colors.surface,
            }}
          />
        );
      })}

      {/* Курсор-скраб */}
      <View style={{ position: "absolute", left: Math.max(0, X(cur) - 0.5), top: padT, width: 1, height: innerH, backgroundColor: colors.ink3, opacity: 0.5 }} />
      {/* Точку курсора прячем, если он стоит на сделке — её маркер сам крупнее. */}
      {tradesAtCur.length === 0 ? (
        <View
          style={{
            position: "absolute",
            left: X(cur) - 4,
            top: Y(pnl[cur].v) - 4,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: color,
            borderWidth: 1.5,
            borderColor: colors.surface,
          }}
        />
      ) : null}

      {/* Тултип: дата + P&L, а рядом — сделки этого дня (при наведении) */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: Math.min(Math.max(0, X(cur) - 60), Math.max(0, w - (tradesAtCur.length ? 300 : 130))),
          backgroundColor: colors.surface2,
          borderRadius: radius.md,
          paddingHorizontal: 10,
          paddingVertical: 6,
          flexDirection: "row",
          gap: 12,
        }}
      >
        <View>
          <Txt color={colors.ink3} size={fontSize.mini}>
            {fmtDateShort(pnl[cur].d)}
          </Txt>
          <Txt color={signColor(pnl[cur].v)} size={fontSize.body} weight="600" mono>
            {signed(pnl[cur].v)} {baseSym()}
          </Txt>
        </View>
        {tradesAtCur.length > 0 ? (
          <View style={{ justifyContent: "center", gap: 4, borderLeftWidth: 1, borderLeftColor: colors.hairline, paddingLeft: 10 }}>
            {tradesAtCur.map((m, k) => {
              const c = m.kind === "buy" ? BUY_COLOR : SELL_COLOR;
              return (
                <View key={k} style={{ gap: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c }} />
                    <Txt color={c} size={fontSize.mini} weight="600">
                      {m.fromAsset} → {m.toAsset}
                    </Txt>
                  </View>
                  <Txt color={colors.ink3} size={fontSize.mini} mono>
                    −{fmtQty(m.fromQty)} {m.fromAsset} / +{fmtQty(m.toQty)} {m.toAsset}
                  </Txt>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>

      {/* Легенда точек сделок */}
      {dots.length > 0 ? (
        <View style={{ position: "absolute", left: 0, bottom: 0, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <LegendDot color={BUY_COLOR} label={t("buy", "покупка")} />
          <LegendDot color={SELL_COLOR} label={t("sell", "продажа")} />
        </View>
      ) : null}
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
      <Txt color={colors.ink3} size={fontSize.mini}>
        {label}
      </Txt>
    </View>
  );
}

/** Столбики P&L по позициям (тап по столбику). */
function TradesChart({ positions }: { positions: Position[] }) {
  const [sel, setSel] = useState<number | null>(null);
  if (positions.length === 0) {
    return (
      <View style={{ height: H, alignItems: "center", justifyContent: "center" }}>
        <Txt color={colors.ink3} size={fontSize.body}>
          {t("No positions yet", "Пока нет позиций")}
        </Txt>
      </View>
    );
  }
  const maxAbs = Math.max(...positions.map((p) => Math.abs(p.pl)), 1);
  const half = (H - 52) / 2; // место под подпись пары снизу и значение сверху

  return (
    <View style={{ height: H, flexDirection: "row", alignItems: "stretch", gap: 6 }}>
      {positions.map((p, i) => {
        const active = sel === i;
        const c = signColor(p.pl);
        const barH = (Math.abs(p.pl) / maxAbs) * half;
        return (
          <Pressable key={i} onPress={() => setSel(i)} style={{ flex: 1, alignItems: "center" }}>
            {/* значение сверху */}
            <Txt color={c} size={fontSize.mini} weight={active ? "700" : "500"} mono numberOfLines={1}>
              {signed(p.pl)}
            </Txt>
            {/* верхняя половина (прибыль вверх) */}
            <View style={{ flex: 1, alignSelf: "stretch", justifyContent: "flex-end", alignItems: "center" }}>
              {p.pl >= 0 ? (
                <View style={{ width: active ? 26 : 20, height: barH, backgroundColor: c, opacity: active ? 1 : 0.85, borderTopLeftRadius: 3, borderTopRightRadius: 3 }} />
              ) : null}
            </View>
            <View style={{ height: 1, alignSelf: "stretch", backgroundColor: colors.hairline }} />
            {/* нижняя половина (убыток вниз) */}
            <View style={{ flex: 1, alignSelf: "stretch", justifyContent: "flex-start", alignItems: "center" }}>
              {p.pl < 0 ? (
                <View style={{ width: active ? 26 : 20, height: barH, backgroundColor: c, opacity: active ? 1 : 0.85, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 }} />
              ) : null}
            </View>
            {/* подпись пары */}
            <Txt color={active ? colors.ink : colors.ink3} size={fontSize.mini} weight={active ? "600" : "400"} numberOfLines={1}>
              {p.from.id}→{p.to.id}
            </Txt>
            <Txt color={colors.ink4} size={fontSize.mini} mono>
              #{p.seq}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}
