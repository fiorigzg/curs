import "react-native-gesture-handler";
// На web графики Skia рендерятся через CanvasKit (WASM). Грузим его до монтирования,
// версия canvaskit-wasm должна совпадать с зависимостью @shopify/react-native-skia (0.39.1).
import { LoadSkiaWeb } from "@shopify/react-native-skia/lib/commonjs/web";

LoadSkiaWeb({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/canvaskit-wasm@0.39.1/bin/full/${file}`,
}).then(async () => {
  const { registerRootComponent } = await import("expo");
  const App = (await import("./App")).default;
  registerRootComponent(App);
});
