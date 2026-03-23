import { useCallback, useEffect, useRef, useState } from "react";
import { useLocalSearchParams, useFocusEffect } from "expo-router";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from "react-native";

import { getEvent, getEventReports } from "../../src/api/client";
import { WS_BASE } from "../../src/api/config";
import { Badge } from "../../src/components/Badge";
import { SectionCard } from "../../src/components/SectionCard";
import { colors, radius, spacing } from "../../src/styles/theme";
import { Event, Report } from "../../src/types/api";

const POLL_INTERVAL_MS = 8000;

function statusTone(status: string) {
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

function trendTone(trend: string) {
  switch (trend) {
    case "growing":
      return "purple";
    case "stable":
      return "teal";
    default:
      return "blue";
  }
}

function severityTone(severity: number) {
  if (severity >= 5) return "red";
  if (severity >= 4) return "yellow";
  if (severity >= 3) return "blue";
  return "gray";
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  const loadEvent = async (silent = false) => {
    if (!id) return;

    try {
      if (!silent) {
        setError(null);
      }

      const [eventData, reportData] = await Promise.all([
        getEvent(id),
        getEventReports(id)
      ]);

      setEvent(eventData);
      setReports(reportData);

      if (!silent) {
        setError(null);
      }
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : "Failed to load event");
      }
    } finally {
      setLoading(false);
    }
  };

  const connectWebSocket = useCallback(() => {
    if (!id) return;

    if (socketRef.current) {
      socketRef.current.close();
    }

    const ws = new WebSocket(`${WS_BASE}/ws/events/${id}`);
    socketRef.current = ws;

    ws.onmessage = (incoming) => {
      try {
        const payload = JSON.parse(incoming.data);
        if (payload.type === "event_updated" && payload.event_id === id) {
          loadEvent(true);
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      socketRef.current = null;
    };
  }, [id]);

  const disconnectWebSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      loadEvent(true);
    }, POLL_INTERVAL_MS);
  }, [id]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    loadEvent();
    startPolling();
    connectWebSocket();

    return () => {
      stopPolling();
      disconnectWebSocket();
    };
  }, [id, startPolling, stopPolling, connectWebSocket, disconnectWebSocket]);

  useFocusEffect(
    useCallback(() => {
      loadEvent(true);
      startPolling();
      connectWebSocket();

      return () => {
        stopPolling();
        disconnectWebSocket();
      };
    }, [id, startPolling, stopPolling, connectWebSocket, disconnectWebSocket])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.muted}>Loading event...</Text>
      </View>
    );
  }

  if (error || !event) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error ?? "Event not found"}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.pollingBox}>
        <Text style={styles.pollingText}>Realtime enabled · polling fallback every 8 seconds</Text>
      </View>

      <View style={styles.hero}>
        <Text style={styles.title}>{event.title}</Text>

        <View style={styles.badgeRow}>
          <Badge label={event.status} tone={statusTone(event.status) as any} />
          <Badge label={event.trend} tone={trendTone(event.trend) as any} />
          <Badge label={`sev ${event.severity}`} tone={severityTone(event.severity) as any} />
          {event.briefing?.incident_type ? (
            <Badge label={event.briefing.incident_type} tone="purple" />
          ) : null}
        </View>

        <Text style={styles.heroSummary}>
          {event.briefing?.summary ?? "No summary available."}
        </Text>
      </View>

      <SectionCard title="Live Metrics">
        <View style={styles.metricsGrid}>
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Severity</Text>
            <Text style={styles.metricValue}>{event.severity}</Text>
          </View>
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Confidence</Text>
            <Text style={styles.metricValue}>{event.confidence}</Text>
          </View>
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Unique</Text>
            <Text style={styles.metricValue}>{event.unique_report_count}</Text>
          </View>
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Duplicates</Text>
            <Text style={styles.metricValue}>{event.duplicate_report_count}</Text>
          </View>
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Velocity/hr</Text>
            <Text style={styles.metricValue}>{event.report_velocity_per_hour}</Text>
          </View>
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Last signal</Text>
            <Text style={styles.metricValue}>{event.minutes_since_last_report}m</Text>
          </View>
        </View>
      </SectionCard>

      <SectionCard title="Recommended Actions">
        {(event.briefing?.recommended_actions ?? []).map((action) => (
          <Text key={action} style={styles.body}>
            • {action}
          </Text>
        ))}
      </SectionCard>

      <SectionCard title="Tags">
        <View style={styles.badgeRow}>
          {(event.briefing?.tags ?? []).map((tag) => (
            <Badge key={tag} label={tag} tone="teal" />
          ))}
        </View>
      </SectionCard>

      <SectionCard title="Source Reports">
        {reports.map((report) => (
          <View key={report.id} style={styles.reportItem}>
            <Text style={styles.reportText}>{report.text}</Text>

            {report.media_url ? (
              <Image source={{ uri: report.media_url }} style={styles.reportImage} />
            ) : null}

            <View style={styles.badgeRow}>
              <Badge
                label={report.is_duplicate ? "duplicate" : "unique"}
                tone={report.is_duplicate ? "yellow" : "green"}
              />
              {event.briefing?.incident_type ? (
                <Badge label={event.briefing.incident_type} tone="purple" />
              ) : null}
            </View>

            <Text style={styles.reportMeta}>trust_score: {report.trust_score}</Text>
            {report.duplicate_of ? (
              <Text style={styles.reportMeta}>duplicate_of: {report.duplicate_of}</Text>
            ) : null}
          </View>
        ))}
      </SectionCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl
  },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm
  },
  pollingBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md
  },
  pollingText: {
    color: colors.textMuted,
    fontSize: 12
  },
  hero: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
    marginBottom: spacing.sm
  },
  heroSummary: {
    color: colors.textSoft,
    lineHeight: 22,
    marginTop: spacing.sm
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  metricBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minWidth: 100
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 12
  },
  metricValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    marginTop: 2
  },
  body: {
    color: colors.textSoft,
    lineHeight: 20
  },
  reportItem: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm
  },
  reportText: {
    color: colors.text,
    lineHeight: 20
  },
  reportMeta: {
    color: colors.textMuted,
    fontSize: 12
  },
  reportImage: {
    width: "100%",
    height: 220,
    borderRadius: radius.md
  },
  muted: {
    color: colors.textMuted
  },
  error: {
    color: "#f87171"
  }
});
