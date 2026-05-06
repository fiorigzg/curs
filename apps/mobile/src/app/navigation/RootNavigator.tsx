/**
 * RootNavigator — auth-гейт.
 *   hydrated=false → spinner
 *   нет access-токена → LoginScreen
 *   иначе → Shell (Sidebar + TopBar + content; адаптивно)
 */
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

import { LoginScreen } from "@/pages/login/LoginScreen";
import { useAssets } from "@/shared/api/hooks";
import type { Asset } from "@/shared/api/types";
import { colors } from "@/shared/config/theme";
import { setRubPerUsd } from "@/shared/lib/format";
import { useAuth } from "@/shared/store/auth";
import { useSettings } from "@/shared/store/settings";

import { Shell } from "../Shell";

export function RootNavigator() {
  const hydrated = useAuth((s) => s.hydrated);
  const accessToken = useAuth((s) => s.accessToken);
  const hydrate = useAuth((s) => s.hydrate);

  const prefsHydrated = useSettings((s) => s.hydrated);
  const hydratePrefs = useSettings((s) => s.hydrate);
  const theme = useSettings((s) => s.theme);
  const lang = useSettings((s) => s.lang);
  const baseCurrency = useSettings((s) => s.baseCurrency);

  // Курс USD→RUB из котировок. Держим здесь (родитель Shell): при загрузке
  // котировок RootNavigator перерисуется и каскадно обновит дерево.
  const { data: assets } = useAssets();
  const usdRate = assets?.find(
    (a: Asset) => a.id === "USD" || (a.class === "fiat" && a.ccy === "USD"),
  )?.price;
  if (usdRate) setRubPerUsd(usdRate);

  useEffect(() => {
    hydrate();
    hydratePrefs();
  }, [hydrate, hydratePrefs]);

  if (!hydrated || !prefsHydrated) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={colors.ink} />
      </View>
    );
  }

  // key завязан на тему/язык/валюту: их смена перемонтирует всё дерево, чтобы
  // компоненты перечитали мутированную палитру colors.*, t() и базовую валюту.
  return (
    <View style={{ flex: 1 }} key={`${theme}:${lang}:${baseCurrency}`}>
      {accessToken ? <Shell /> : <LoginScreen />}
    </View>
  );
}
