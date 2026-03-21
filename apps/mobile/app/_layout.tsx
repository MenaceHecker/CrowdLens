import { Stack } from "expo-router";
import { colors } from "../src/styles/theme";

export default function RootLayout() {
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