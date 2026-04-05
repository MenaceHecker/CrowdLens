import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { EventUrgencyLevel, FeedItem } from "../types/api";
import { colors, radius, spacing, shadows } from "../styles/theme";

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

function getUrgencyColor(urgencyLevel: EventUrgencyLevel) {
  if (urgencyLevel === "breaking") return "#ef4444";
  if (urgencyLevel === "active") return "#f59e0b";
  return "#64748b";
}

function getSurgeColor(surgeStatus?: string) {
  if (surgeStatus === "surging") return "#f97316";
  if (surgeStatus === "stable") return "#2563eb";
  if (surgeStatus === "cooling") return "#64748b";
  return colors.badgeNeutral;
}

function getBriefingSeverityColor(severity?: string) {
  if (severity === "critical") return "#b91c1c";
  if (severity === "high") return "#ea580c";
  if (severity === "medium" || severity === "moderate") return "#ca8a04";
  if (severity === "low") return "#16a34a";
  return colors.badgeNeutral;
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
  const { event, latest_report_preview } = item;

  const mediaUrl = latest_report_preview?.media_url ?? null;
  const hasVideo = mediaUrl ? isVideoUrl(mediaUrl) : false;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
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

      <View style={styles.priorityRow}>
        <View style={[styles.badge, styles.badgeSolid, { backgroundColor: getUrgencyColor(event.urgency_level) }]}>
          <Text style={styles.badgeTextSolid}>{event.urgency_level.toUpperCase()}</Text>
        </View>

        {event.surge_status ? (
          <View style={[styles.badge, styles.badgeSolid, { backgroundColor: getSurgeColor(event.surge_status) }]}>
            <Text style={styles.badgeTextSolid}>{event.surge_status.toUpperCase()}</Text>
          </View>
        ) : null}

        {event.briefing?.severity ? (
          <View
            style={[
              styles.badge,
              styles.badgeSolid,
              { backgroundColor: getBriefingSeverityColor(event.briefing.severity) }
            ]}
          >
            <Text style={styles.badgeTextSolid}>{event.briefing.severity.toUpperCase()}</Text>
          </View>
        ) : null}
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
        {event.briefing?.summary ?? latest_report_preview?.text ?? "No summary available yet."}
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

        {latest_report_preview ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>trust {latest_report_preview.trust_score}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.footerText}>
          Unique: {event.unique_report_count} · Duplicates: {event.duplicate_report_count}
        </Text>
        <Text style={styles.footerTextStrong}>Rank {event.ranking_score}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
    ...shadows.card
  },
  cardPressed: {
    opacity: 0.96,
    transform: [{ scale: 0.995 }]
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm
  },
  severityDot: {
    width: 12,
    height: 12,
    borderRadius: radius.pill,
    marginTop: 6
  },
  headerTextWrap: {
    flex: 1
  },
  title: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: -0.3
  },
  subtitle: {
    color: colors.textMuted,
    marginTop: 5,
    fontSize: 12,
    lineHeight: 18
  },
  priorityRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  thumbnail: {
    width: "100%",
    height: 190,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSoft
  },
  videoBox: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: "center",
    justifyContent: "center"
  },
  videoBadge: {
    color: colors.textSoft,
    fontWeight: "700",
    fontSize: 13
  },
  summary: {
    color: colors.textSoft,
    lineHeight: 22,
    fontSize: 14
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  badge: {
    backgroundColor: colors.badgeNeutral,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill
  },
  badgeSolid: {
    borderWidth: 0
  },
  badgeText: {
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.2
  },
  badgeTextSolid: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.3
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
    paddingTop: 2
  },
  footerText: {
    color: colors.textDim,
    fontSize: 12
  },
  footerTextStrong: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  }
});