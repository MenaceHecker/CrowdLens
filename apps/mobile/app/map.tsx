import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Callout, Marker } from "react-native-maps";
import { router } from "expo-router";

import { getFeed } from "../src/api/client";
import { colors, radius, spacing } from "../src/styles/theme";
import { FeedItem } from "../src/types/api";

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

export default function MapScreen() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true
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
                        Severity {event.severity} · Confidence {event.confidence}
                      </Text>
                    </View>
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
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{event.report_count} reports</Text>
                    </View>
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
  calloutCard: {
    width: 280,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  calloutHeader: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  severityDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    marginTop: 5,
  },
  calloutHeaderText: {
    flex: 1,
  },
  calloutTitle: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 16,
  },
  calloutSubtitle: {
    color: colors.textMuted,
    marginTop: 4,
    fontSize: 12,
  },
  calloutSummary: {
    color: colors.textSoft,
    lineHeight: 20,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  badge: {
    backgroundColor: colors.bg,
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
  openButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: "center",
  },
  openButtonText: {
    color: "#fff",
    fontWeight: "800",
  },
});