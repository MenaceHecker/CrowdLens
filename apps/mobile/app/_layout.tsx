import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#111827" },
        headerTintColor: "#ffffff",
        contentStyle: { backgroundColor: "#0b1220" }
      }}
    >
      <Stack.Screen name="index" options={{ title: "CrowdLens Feed" }} />
      <Stack.Screen name="event/[id]" options={{ title: "Event Details" }} />
      <Stack.Screen name="report" options={{ title: "Submit Report" }} />
    </Stack>
  );
}