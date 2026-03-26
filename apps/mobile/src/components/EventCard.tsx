import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { getReport } from "../api/client";
import { FeedItem, Report } from "../types/api";
import { colors, radius, spacing } from "../styles/theme";

function getSeverityLabel(severity: number) {
  if (severity >= 5) return "critical";
  if (severity >= 4) return "high";
  if (severity >= 3) return "medium";
  return "low";
}

function getSeverityColor(severity: number) {
  if (severity >= 5) return "#dc2626";
  if (severity >= 4) return "#f97316";
  if (severity >= 3) return "#2563eb";
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

type Props = {
  item: FeedItem;
};

export function EventCard({ item }: Props) {
  const { event, latest_report_id } = item;
  const [latestReport, setLatestReport] = useState<Report | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadLatestReport() {
      if (!latest_report_id) return;

      try {
        const report = await getReport(latest_report_id);
        if (isMounted) {
          setLatestReport(report);
        }
      } catch {
        // ignore latest report fetch failures
      }
    }

    loadLatestReport();

    return () => {
      isMounted = false;
    };
  }, [latest_report_id]);

  const mediaUrl = latestReport?.media_url ?? null;
  const hasVideo = mediaUrl ? isVideoUrl(mediaUrl) : false;

  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/event/${event.id}`)}
    >
      <View style={styles.headerRow}>
        <View style={[styles.severityDot, { backgroundColor: getSeverityColor(event.severity) }]} />
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>{event.title}</Text>
          <Text style={styles.subtitle}>
            {getSeverityLabel(event.severity)} · confidence {event.confidence} · {event.report_count} reports
          </Text>
        </View>
      </View>

      {mediaUrl && !hasVideo ? (
        <Image source={{ uri: mediaUrl }} style={styles.thumbnail} />
      ) : null}

      {mediaUrl && hasVideo ? (
        <View style={styles.videoBox}>
          <Text style={styles.videoBadge}>Video attached</Text>
        </View>
      ) : null}

      <Text style={styles.summary}>
        {event.briefing?.summary ?? "No summary available yet."}
      </Text>

      <View style={styles.badgeRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{event.status}</Text>
        </View>

        <View style={styles.badge}>
          <Text style={styles.badgeText}>{event.trend}</Text>
        </View>

        {event.briefing?.incident_type ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{event.briefing.incident_type}</Text>
          </View>
        ) : null}

        {mediaUrl ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{hasVideo ? "video" : "image"}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.footerText}>
          Unique: {event.unique_report_count} · Duplicates: {event.duplicate_report_count}
        </Text>
        <Text style={styles.footerText}>Rank {event.ranking_score}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  severityDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    marginTop: 5,
  },
  headerTextWrap: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.textMuted,
    marginTop: 4,
    fontSize: 12,
  },
  thumbnail: {
    width: "100%",
    height: 180,
    borderRadius: radius.md,
  },
  videoBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  videoBadge: {
    color: colors.textSoft,
    fontWeight: "700",
  },
  summary: {
    color: colors.textSoft,
    lineHeight: 20,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  badge: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  footerText: {
    color: colors.textMuted,
    fontSize: 12,
  },
});