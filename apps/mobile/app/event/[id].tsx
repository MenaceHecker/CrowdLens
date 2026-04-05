import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { getEvent, getEventReports } from "../../src/api/client";
import { colors, radius, spacing, shadows } from "../../src/styles/theme";
import { Event, Report } from "../../src/types/api";

function formatTimestamp(value: string | null) {
  if (!value) return "Unknown time";
  const date = new Date(value);
  return date.toLocaleString();
}

function getSeverityLabel(severity: number) {
  if (severity >= 5) return "critical";
  if (severity >= 4) return "high";
  if (severity >= 3) return "medium";
  return "low";
}

function getSeverityColor(severity: number) {
  if (severity >= 5) return "#ef4444";
  if (severity >= 4) return "#f97316";
  if (severity >= 3) return "#3b82f6";
  return "#14b8a6";
}

function isVideoUrl(url: string) {
  const lower = url.toLowerCase();
  return (
    lower.includes(".mp4") ||
    lower.includes(".mov") ||
    lower.includes(".m4v") ||
    lower.includes(".webm") ||
    lower.includes("video")
  );
}

function EventBadge({ label }: { label: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

function ReportCard({ report }: { report: Report }) {
  const hasMedia = !!report.media_url;
  const isVideo = report.media_url ? isVideoUrl(report.media_url) : false;

  return (
    <View style={styles.reportCard}>
      <View style={styles.reportHeader}>
        <Text style={styles.reportTitle}>Report</Text>
        <Text style={styles.reportTimestamp}>{formatTimestamp(report.created_at)}</Text>
      </View>

      {hasMedia && !isVideo ? (
        <Image source={{ uri: report.media_url! }} style={styles.reportImage} />
      ) : null}

      {hasMedia && isVideo ? (
        <View style={styles.videoBox}>
          <Text style={styles.videoText}>Video attached</Text>
        </View>
      ) : null}

      <Text style={styles.reportBody}>{report.text}</Text>

      <View style={styles.reportMetaWrap}>
        <Text style={styles.reportMeta}>trust_score: {report.trust_score}</Text>
        <Text style={styles.reportMeta}>status: {report.status}</Text>
        <Text style={styles.reportMeta}>user_id: {report.user_id}</Text>
        {report.is_duplicate ? (
          <Text style={styles.reportMeta}>
            duplicate_of: {report.duplicate_of ?? "unknown"}
          </Text>
        ) : (
          <Text style={styles.reportMeta}>unique report</Text>
        )}
      </View>
    </View>
  );
}

export default function EventDetailScreen() {
  const params = useLocalSearchParams();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const id = typeof rawId === "string" ? rawId.trim() : "";

  const [event, setEvent] = useState<Event | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      setEvent(null);
      setReports([]);
      setError("Missing event id");
      return;
    }

    setError(null);

    // Load event first. This is the critical request.
    const eventData = await getEvent(id);
    setEvent(eventData);

    // Load reports separately so a reports failure does not make the event vanish.
    try {
      const reportData = await getEventReports(id);
      setReports(reportData);
    } catch {
      setReports([]);
    }
  }, [id]);

  useEffect(() => {
    let mounted = true;

    async function run() {
      try {
        await load();
      } catch (err) {
        if (!mounted) return;
        setEvent(null);
        setReports([]);
        setError(err instanceof Error ? err.message : "Failed to load event");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    run();

    return () => {
      mounted = false;
    };
  }, [load]);

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh event");
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.muted}>Loading event details...</Text>
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Event not found.</Text>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    );
  }

  const primaryMediaReport =
    reports.find((report) => report.media_url && !isVideoUrl(report.media_url)) ??
    reports.find((report) => report.media_url) ??
    null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View
            style={[
              styles.severityDot,
              { backgroundColor: getSeverityColor(event.severity) },
            ]}
          />
          <View style={styles.heroHeaderText}>
            <Text style={styles.heroTitle}>{event.title}</Text>
            <Text style={styles.heroSubtitle}>
              {getSeverityLabel(event.severity)} · confidence {event.confidence} · rank {event.ranking_score}
            </Text>
          </View>
        </View>

        {primaryMediaReport?.media_url && !isVideoUrl(primaryMediaReport.media_url) ? (
          <Image
            source={{ uri: primaryMediaReport.media_url }}
            style={styles.heroImage}
          />
        ) : null}

        {primaryMediaReport?.media_url && isVideoUrl(primaryMediaReport.media_url) ? (
          <View style={styles.videoBoxLarge}>
            <Text style={styles.videoText}>Video attached to this event</Text>
          </View>
        ) : null}

        <Text style={styles.summaryText}>
          {event.briefing?.summary ?? "No event summary available yet."}
        </Text>

        <View style={styles.badgeRow}>
          <EventBadge label={event.status} />
          <EventBadge label={event.trend} />
          <EventBadge label={`severity ${event.severity}`} />
          {event.urgency_level ? <EventBadge label={event.urgency_level} /> : null}
          {event.surge_status ? <EventBadge label={event.surge_status} /> : null}
          {event.briefing?.incident_type ? (
            <EventBadge label={event.briefing.incident_type} />
          ) : null}
          {primaryMediaReport?.media_url ? (
            <EventBadge
              label={isVideoUrl(primaryMediaReport.media_url) ? "video" : "image"}
            />
          ) : null}
        </View>
      </View>

      <View style={styles.statsCard}>
        <Text style={styles.sectionTitle}>Event stats</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{event.report_count}</Text>
            <Text style={styles.statLabel}>reports</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{event.unique_report_count}</Text>
            <Text style={styles.statLabel}>unique</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{event.duplicate_report_count}</Text>
            <Text style={styles.statLabel}>duplicates</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{event.minutes_since_last_report}</Text>
            <Text style={styles.statLabel}>mins ago</Text>
          </View>
        </View>
      </View>

      {event.briefing?.recommended_actions?.length ? (
        <View style={styles.actionsCard}>
          <Text style={styles.sectionTitle}>Recommended actions</Text>
          {event.briefing.recommended_actions.map((action, index) => (
            <Text key={`${action}-${index}`} style={styles.actionItem}>
              • {action}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={styles.reportsSection}>
        <Text style={styles.sectionTitle}>Reports</Text>
        {reports.length > 0 ? (
          reports.map((report) => <ReportCard key={report.id} report={report} />)
        ) : (
          <View style={styles.emptyReportsCard}>
            <Text style={styles.muted}>No reports available for this event yet.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  muted: {
    color: colors.textMuted,
    textAlign: "center",
  },
  errorText: {
    color: colors.danger,
    textAlign: "center",
    marginTop: spacing.xs,
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.card,
  },
  heroHeader: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  severityDot: {
    width: 14,
    height: 14,
    borderRadius: 999,
    marginTop: 6,
  },
  heroHeaderText: {
    flex: 1,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
  },
  heroSubtitle: {
    color: colors.textMuted,
    marginTop: 4,
  },
  heroImage: {
    width: "100%",
    height: 240,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
  },
  videoBoxLarge: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryText: {
    color: colors.textSoft,
    lineHeight: 22,
    fontSize: 16,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  badge: {
    backgroundColor: colors.badgeNeutral,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: "700",
  },
  statsCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.card,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  statBox: {
    flexGrow: 1,
    minWidth: "45%",
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  statValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
  },
  statLabel: {
    color: colors.textMuted,
    marginTop: 4,
  },
  actionsCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.card,
  },
  actionItem: {
    color: colors.textSoft,
    lineHeight: 22,
  },
  reportsSection: {
    gap: spacing.md,
  },
  emptyReportsCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.md,
    ...shadows.card,
  },
  reportCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.card,
  },
  reportHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  reportTitle: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 16,
  },
  reportTimestamp: {
    color: colors.textMuted,
    fontSize: 12,
    flexShrink: 1,
    textAlign: "right",
  },
  reportImage: {
    width: "100%",
    height: 220,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
  },
  videoBox: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  videoText: {
    color: colors.textSoft,
    fontWeight: "700",
  },
  reportBody: {
    color: colors.textSoft,
    lineHeight: 22,
  },
  reportMetaWrap: {
    gap: 4,
  },
  reportMeta: {
    color: colors.textMuted,
    fontSize: 12,
  },
});