import { View } from "react-native";

import { assetIcon } from "@/shared/config/theme";
import { Txt } from "./Txt";

export function AssetIcon({ id, size = 36 }: { id: string; size?: number }) {
  const palette = assetIcon[id] ?? assetIcon.default;
  const label = id === "OFZ26240" ? "ОФЗ" : id.slice(0, 4);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size > 30 ? 10 : 7,
        backgroundColor: palette.bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Txt color={palette.fg} size={size > 32 ? 12 : size > 26 ? 11 : 10} weight="600" mono>
        {label}
      </Txt>
    </View>
  );
}
