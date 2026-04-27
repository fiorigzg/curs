import { Canvas, Path, Skia } from "@shopify/react-native-skia";

import type { ByClassItem } from "@/shared/api/types";
import { classColor } from "@/shared/config/theme";

/** Кольцевая диаграмма по классам (CURS_CHARTS.Donut). */
export function Donut({ items, size = 140, thickness = 20 }: { items: ByClassItem[]; size?: number; thickness?: number }) {
  const total = items.reduce((s, it) => s + it.value, 0) || 1;
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;

  let start = -90; // сверху
  const arcs = items.map((it) => {
    const sweep = (it.value / total) * 360;
    const path = Skia.Path.Make();
    const rect = Skia.XYWHRect(cx - r, cy - r, r * 2, r * 2);
    path.addArc(rect, start, sweep);
    start += sweep;
    return { path, color: classColor[it.class] ?? "#807D74" };
  });

  return (
    <Canvas style={{ width: size, height: size }}>
      {arcs.map((a, i) => (
        <Path
          key={i}
          path={a.path}
          style="stroke"
          strokeWidth={thickness}
          color={a.color}
          strokeCap="butt"
        />
      ))}
    </Canvas>
  );
}
