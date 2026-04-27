import { View } from "react-native";

import { colors } from "@/shared/config/theme";
import type { StructureItem } from "@/shared/api/types";
import { Txt } from "../Txt";

/**
 * Упрощённый squarified treemap: жадная раскладка по строкам.
 * Достаточно близко к CURS_CHARTS.Treemap для мобильного экрана.
 */
export function Treemap({ items, height = 220 }: { items: StructureItem[]; height?: number }) {
  if (!items.length) return <View style={{ height }} />;
  const total = items.reduce((s, it) => s + it.value, 0) || 1;

  // Раскладываем по строкам: каждая строка ~ фикс. доля высоты по сумме значений.
  const rows: StructureItem[][] = [];
  let row: StructureItem[] = [];
  let rowSum = 0;
  const targetPerRow = total / Math.max(1, Math.round(Math.sqrt(items.length)));
  for (const it of items) {
    row.push(it);
    rowSum += it.value;
    if (rowSum >= targetPerRow) {
      rows.push(row);
      row = [];
      rowSum = 0;
    }
  }
  if (row.length) rows.push(row);

  return (
    <View style={{ height, borderRadius: 10, overflow: "hidden", gap: 3 }}>
      {rows.map((r, ri) => {
        const rowVal = r.reduce((s, it) => s + it.value, 0) || 1;
        const rowFlex = rowVal / total;
        return (
          <View key={ri} style={{ flex: rowFlex, flexDirection: "row", gap: 3 }}>
            {r.map((it) => (
              <View
                key={it.label}
                style={{
                  flex: it.value / rowVal,
                  backgroundColor: it.color,
                  borderRadius: 6,
                  padding: 8,
                  justifyContent: "space-between",
                }}
              >
                <Txt color={pickFg(it.color)} size={12} weight="700">
                  {it.label}
                </Txt>
                <Txt color={pickFg(it.color)} size={10} mono style={{ opacity: 0.85 }}>
                  {(it.share * 100).toFixed(1).replace(".", ",")}%
                </Txt>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

// Светлый текст на тёмном фоне и наоборот.
function pickFg(bg: string): string {
  const light = ["#D7E041", "#86B0A0", "#B5B1A6"];
  return light.includes(bg) ? colors.ink : colors.white;
}
