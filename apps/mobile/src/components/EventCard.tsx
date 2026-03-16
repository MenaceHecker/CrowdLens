import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { FeedItem } from "../types/api";
import { colors, radius, spacing } from "../styles/theme";
import { Badge } from "./Badge";

interface EventCardProps {
  item: FeedItem;
}

function getStatusTone(status: string) {
  switch (status) {
    case "active":
      return "red";
    case "cooling_down":
      return "yellow";
    case "resolved":
      return "gray";
    default:
      return "blue";
  }
}

function getTrendTone(trend: string) {
  switch (trend) {
    case "growing":
      return "purple";
    case "stable":
      return "teal";
    default:
      return "blue";
  }
}

function getSeverityTone(severity: number) {
  if (severity >= 5) return "red";
  if (severity >= 4) return "yellow";
  if (severity >= 3) return "blue";
  return "gray";
}

export function EventCard({ item }: EventCardProps) {
  const event = item.event;

  return (
    <Link href={`/event/${event.id}`} asChild>
      <Pressable style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{event.title}</Text>
          <Text style={styles.rank}>#{event.ranking_score}</Text>
        </View>

        <View style={styles.badgeRow}>
          <Badge label={event.status} tone={getStatusTone(event.status) as any} />
          <Badge label={event.trend} tone={getTrendTone(event.trend) as any} />
          <Badge label={`sev ${event.severity}`} tone={getSeverityTone(event.severity) as any} />
        </View>

        <Text style={styles.summary} numberOfLines={3}>
          {event.briefing?.summary ?? "No briefing available."}
        </Text>

        <View style={styles.metricsGrid}>
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Unique</Text>
            <Text style={styles.metricValue}>{event.unique_report_count}</Text>
          </View>
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Dupes</Text>
            <Text style={styles.metricValue}>{event.duplicate_report_count}</Text>
          </View>
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Confidence</Text>
            <Text style={styles.metricValue}>{event.confidence}</Text>
          </View>
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Recent</Text>
            <Text style={styles.metricValue}>{event.is_recent ? "Yes" : "No"}</Text>
          </View>
        </View>

        <Text style={styles.footer}>
          {event.minutes_since_last_report} min ago · {event.report_velocity_per_hour}/hr
        </Text>
      </Pressable>
    </Link>
  );
}