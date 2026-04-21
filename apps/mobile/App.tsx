import { StatusBar } from "expo-status-bar";

import { AppProviders } from "@/app/providers";
import { RootNavigator } from "@/app/navigation/RootNavigator";
import { useSettings } from "@/shared/store/settings";

export default function App() {
  const theme = useSettings((s) => s.theme);
  return (
    <AppProviders>
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
      <RootNavigator />
    </AppProviders>
  );
}
