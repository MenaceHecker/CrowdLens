import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../styles/theme";

type BadgeTone =
  | "blue"
  | "green"
  | "yellow"
  | "red"
  | "purple"
  | "gray"
  | "teal";

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
}

const toneMap: Record<BadgeTone, { bg: string; text: string }> = {
  blue: { bg: "#1d4ed8", text: "#eff6ff" },
  green: { bg: "#166534", text: "#ecfdf5" },
  yellow: { bg: "#a16207", text: "#fefce8" },
  red: { bg: "#991b1b", text: "#fef2f2" },
  purple: { bg: "#6d28d9", text: "#f5f3ff" },
  gray: { bg: colors.grayBadge, text: "#e2e8f0" },
  teal: { bg: "#115e59", text: "#f0fdfa" }
};

export function Badge({ label, tone = "gray" }: BadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor: toneMap[tone].bg }]}>
      <Text style={[styles.text, { color: toneMap[tone].text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.xl,
    alignSelf: "flex-start"
  },
  text: {
    fontSize: 12,
    fontWeight: "700"
  }
});