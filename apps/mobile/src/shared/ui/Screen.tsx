import type { ReactNode } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/shared/config/theme";

interface Props {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  scroll?: boolean;
}

export function Screen({ children, refreshing, onRefresh, scroll = true }: Props) {
  const insets = useSafeAreaInsets();
  const top = insets.top + 8;

  if (!scroll) {
    return <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: top }}>{children}</View>;
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: top, paddingBottom: 110 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.ink3} /> : undefined
      }
    >
      {children}
    </ScrollView>
  );
}
