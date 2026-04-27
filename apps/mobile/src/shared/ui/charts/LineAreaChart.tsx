import { Canvas, LinearGradient, Path, Skia, vec } from "@shopify/react-native-skia";
import { useState } from "react";
import { View } from "react-native";

import { colors } from "@/shared/config/theme";
import type { PointTV } from "@/shared/api/types";

/** Линия со сглаживанием + площадь-градиент (CURS_CHARTS.LineAreaChart). */
export function LineAreaChart({
  series,
  height = 170,
  color = colors.ink,
}: {
  series: PointTV[];
  height?: number;
  color?: string;
}) {
  const [w, setW] = useState(320);

  if (!series || series.length < 2) {
    return <View style={{ height }} onLayout={(e) => setW(e.nativeEvent.layout.width)} />;
  }

  const vals = series.map((p) => p.v);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const pad = (max - min) * 0.08 || 1;
  const yMin = min - pad;
  const yMax = max + pad;
  const padT = 10;
  const padB = 8;
  const innerH = height - padT - padB;
  const stepX = w / (series.length - 1);

  const pts = series.map((p, i) => ({
    x: i * stepX,
    y: padT + (1 - (p.v - yMin) / (yMax - yMin)) * innerH,
  }));

  // Сглаживание Catmull-Rom → кубические Безье.
  const line = Skia.Path.Make();
  line.moveTo(pts[0].x, pts[0].y);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    line.cubicTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
  }

  const area = line.copy();
  area.lineTo(pts[pts.length - 1].x, height);
  area.lineTo(pts[0].x, height);
  area.close();

  return (
    <View style={{ height }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <Canvas style={{ flex: 1 }}>
        <Path path={area}>
          <LinearGradient
            start={vec(0, 0)}
            end={vec(0, height)}
            colors={["rgba(21,20,15,0.10)", "rgba(21,20,15,0)"]}
          />
        </Path>
        <Path path={line} style="stroke" strokeWidth={1.8} color={color} strokeJoin="round" strokeCap="round" />
      </Canvas>
    </View>
  );
}
