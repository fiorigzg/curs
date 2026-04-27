import { Canvas, Path, Skia } from "@shopify/react-native-skia";
import { View } from "react-native";

import { colors } from "@/shared/config/theme";
import type { PointTV } from "@/shared/api/types";

/** Мини-линия (CURS_CHARTS.Sparkline) на Skia. */
export function Sparkline({
  series,
  width,
  height,
  positive,
  thickness = 1.6,
}: {
  series: PointTV[];
  width: number;
  height: number;
  positive?: boolean;
  thickness?: number;
}) {
  const color = positive === undefined ? colors.ink : positive ? colors.up : colors.down;
  if (!series || series.length < 2) {
    return <View style={{ width, height }} />;
  }

  const vals = series.map((p) => p.v);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const pad = 2;
  const stepX = (width - pad * 2) / (series.length - 1);

  const path = Skia.Path.Make();
  series.forEach((p, i) => {
    const x = pad + i * stepX;
    const y = pad + (1 - (p.v - min) / range) * (height - pad * 2);
    if (i === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  });

  return (
    <Canvas style={{ width, height }}>
      <Path path={path} style="stroke" strokeWidth={thickness} color={color} strokeJoin="round" strokeCap="round" />
    </Canvas>
  );
}
