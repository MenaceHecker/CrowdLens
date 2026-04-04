import { useEffect } from "react";
import * as SplashScreen from "expo-splash-screen";
import { Stack } from "expo-router";
import { colors } from "../src/styles/theme";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    const prepare = async () => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      await SplashScreen.hideAsync();
    };

    prepare();
  }, []);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: "700" },
        contentStyle: { backgroundColor: colors.bg }
      }}
    >
      <Stack.Screen name="index" options={{ title: "CrowdLens Feed" }} />
      <Stack.Screen name="map" options={{ title: "Incident Map" }} />
      <Stack.Screen name="auth" options={{ title: "Authentication" }} />
      <Stack.Screen name="event/[id]" options={{ title: "Event Details" }} />
      <Stack.Screen name="report" options={{ title: "Submit Report" }} />
    </Stack>
  );
}
