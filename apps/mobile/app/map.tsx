import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Callout, Marker } from "react-native-maps";
import { router } from "expo-router";

import { getFeed } from "../src/api/client";
import { colors, radius, spacing, shadows } from "../src/styles/theme";
import { FeedItem } from "../src/types/api";

function getSeverityColor(severity: number) {
  if (severity >= 5) return "#ef4444";
  if (severity >= 4) return "#f97316";
  if (severity >= 3) return "#3b82f6";
  return "#14b8a6";
}

function getUrgencyColor(urgencyLevel?: string) {
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

export default function MapScreen() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const feed = await getFeed();
        if (mounted) setItems(feed);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const initialRegion = useMemo(
    () => ({
      latitude: 33.7756,
      longitude: -84.3963,
      latitudeDelta: 0.03,
      longitudeDelta: 0.03,
    }),
    []
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.muted}>Loading map...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView style={styles.map} initialRegion={initialRegion}>
        {items.map((item) => {
          const { event, latest_report_preview } = item;
          const mediaUrl = latest_report_preview?.media_url ?? null;
          const hasVideo = mediaUrl ? isVideoUrl(mediaUrl) : false;

          return (
            <Marker
              key={event.id}
              coordinate={{
                latitude: event.centroid.lat,
                longitude: event.centroid.lng,
              }}
              pinColor={getSeverityColor(event.severity)}
            >
              <Callout tooltip onPress={() => router.push(`/event/${event.id}`)}>
                <View style={styles.calloutCard}>
                  <View style={styles.calloutHeader}>
                    <View
                      style={[
                        styles.severityDot,
                        { backgroundColor: getSeverityColor(event.severity) },
                      ]}
                    />
                    <View style={styles.calloutHeaderText}>
                      <Text style={styles.calloutTitle}>{event.title}</Text>
                      <Text style={styles.calloutSubtitle}>
                        Severity {event.severity} · Confidence {event.confidence} · {event.report_count} reports
                      </Text>
                    </View>
                  </View>

                  <View style={styles.priorityRow}>
                    {event.urgency_level ? (
                      <View
                        style={[
                          styles.badge,
                          styles.badgeSolid,
                          { backgroundColor: getUrgencyColor(event.urgency_level) },
                        ]}
                      >
                        <Text style={styles.badgeTextSolid}>{event.urgency_level.toUpperCase()}</Text>
                      </View>
                    ) : null}

                    {event.surge_status ? (
                      <View
                        style={[
                          styles.badge,
                          styles.badgeSolid,
                          { backgroundColor: getSurgeColor(event.surge_status) },
                        ]}
                      >
                        <Text style={styles.badgeTextSolid}>{event.surge_status.toUpperCase()}</Text>
                      </View>
                    ) : null}

                    {event.briefing?.severity ? (
                      <View
                        style={[
                          styles.badge,
                          styles.badgeSolid,
                          { backgroundColor: getBriefingSeverityColor(event.briefing.severity) },
                        ]}
                      >
                        <Text style={styles.badgeTextSolid}>{event.briefing.severity.toUpperCase()}</Text>
                      </View>
                    ) : null}
                  </View>

                  <Text style={styles.calloutSummary} numberOfLines={4}>
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
                  </View>

                  <Pressable
                    style={styles.openButton}
                    onPress={() => router.push(`/event/${event.id}`)}
                  >
                    <Text style={styles.openButtonText}>Open event</Text>
                  </Pressable>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>

      <View style={styles.mapOverlay}>
        <Text style={styles.mapOverlayEyebrow}>Live map</Text>
        <Text style={styles.mapOverlayTitle}>Incident hotspots</Text>
        <Text style={styles.mapOverlaySubtitle}>
          Tap a marker to preview severity, urgency, and event details.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  map: {
    flex: 1,
  },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  muted: {
    color: colors.textMuted,
  },
  mapOverlay: {
    position: "absolute",
    top: spacing.lg,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.md,
    ...shadows.card,
  },
  mapOverlayEyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  mapOverlayTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  mapOverlaySubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  calloutCard: {
    width: 300,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.card,
  },
  calloutHeader: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  severityDot: {
    width: 12,
    height: 12,
    borderRadius: radius.pill,
    marginTop: 6,
  },
  calloutHeaderText: {
    flex: 1,
  },
  calloutTitle: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 17,
    letterSpacing: -0.2,
  },
  calloutSubtitle: {
    color: colors.textMuted,
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
  },
  priorityRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  calloutSummary: {
    color: colors.textSoft,
    lineHeight: 20,
    fontSize: 13,
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
    borderRadius: radius.pill,
  },
  badgeSolid: {
    borderWidth: 0,
  },
  badgeText: {
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  badgeTextSolid: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  openButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 11,
    alignItems: "center",
    marginTop: 2,
  },
  openButtonText: {
    color: colors.white,
    fontWeight: "800",
    fontSize: 13,
  },
});