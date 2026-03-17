import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useFocusEffect, router } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import MapView, { Callout, Marker, Region } from "react-native-maps";

import { getFeed, processNextJob } from "../src/api/client";
import { WS_BASE } from "../src/api/config";
import { colors, radius, spacing } from "../src/styles/theme";
import { FeedItem } from "../src/types/api";

const POLL_INTERVAL_MS = 8000;

function markerColor(status: string, severity: number) {
  if (status === "resolved") return "#64748b";
  if (status === "cooling_down") return "#f59e0b";
  if (severity >= 5) return "#dc2626";
  if (severity >= 4) return "#f97316";
  if (severity >= 3) return "#2563eb";
  return "#14b8a6";
}

function buildRegion(items: FeedItem[]): Region {
  if (items.length === 0) {
    return {
      latitude: 33.7756,
      longitude: -84.3963,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08
    };
  }

  if (items.length === 1) {
    return {
      latitude: items[0].event.centroid.lat,
      longitude: items[0].event.centroid.lng,
      latitudeDelta: 0.03,
      longitudeDelta: 0.03
    };
  }

  const lats = items.map((item) => item.event.centroid.lat);
  const lngs = items.map((item) => item.event.centroid.lng);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.8, 0.03),
    longitudeDelta: Math.max((maxLng - minLng) * 1.8, 0.03)
  };
}

export default function MapScreen() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingJob, setProcessingJob] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  const loadFeed = async (silent = false) => {
    try {
      if (!silent) {
        setError(null);
      }
      const data = await getFeed();
      setItems(data);
      if (!silent) {
        setError(null);
      }
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : "Failed to load map data");
      }
    } finally {
      setLoading(false);
    }
  };

  const connectWebSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close();
    }

    const ws = new WebSocket(`${WS_BASE}/ws/feed`);
    socketRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "feed_updated") {
          loadFeed(true);
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      socketRef.current = null;
    };
  }, []);

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
      loadFeed(true);
    }, POLL_INTERVAL_MS);
  }, []);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const handleProcessNext = async () => {
    try {
      setProcessingJob(true);
      setError(null);
      await processNextJob();
      await loadFeed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process next job");
    } finally {
      setProcessingJob(false);
    }
  };

  useEffect(() => {
    loadFeed();
    startPolling();
    connectWebSocket();

    return () => {
      stopPolling();
      disconnectWebSocket();
    };
  }, [startPolling, stopPolling, connectWebSocket, disconnectWebSocket]);

  useFocusEffect(
    useCallback(() => {
      loadFeed(true);
      startPolling();
      connectWebSocket();

      return () => {
        stopPolling();
        disconnectWebSocket();
      };
    }, [startPolling, stopPolling, connectWebSocket, disconnectWebSocket])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.muted}>Loading map...</Text>
      </View>
    );
  }

  const region = buildRegion(items);

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.heading}>Live Incident Map</Text>
          <Text style={styles.subheading}>
            Realtime event pins based on centroid and severity
          </Text>
        </View>

        <View style={styles.actions}>
          <Link href="/report" asChild>
            <Pressable style={[styles.button, styles.primaryButton]}>
              <Text style={styles.primaryButtonText}>+ Report</Text>
            </Pressable>
          </Link>

          <Pressable
            style={[styles.button, styles.secondaryButton]}
            onPress={handleProcessNext}
            disabled={processingJob}
          >
            <Text style={styles.secondaryButtonText}>
              {processingJob ? "Processing..." : "Process Next Job"}
            </Text>
          </Pressable>
        </View>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Couldn’t load the map</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <MapView style={styles.map} initialRegion={region} region={region}>
        {items.map((item) => {
          const event = item.event;
          return (
            <Marker
              key={event.id}
              coordinate={{
                latitude: event.centroid.lat,
                longitude: event.centroid.lng
              }}
              pinColor={markerColor(event.status, event.severity)}
            >
              <Callout onPress={() => router.push(`/event/${event.id}`)}>
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle}>{event.title}</Text>
                  <Text style={styles.calloutText}>
                    Status: {event.status} · Severity: {event.severity}
                  </Text>
                  <Text style={styles.calloutText}>
                    Rank: {event.ranking_score} · Unique: {event.unique_report_count}
                  </Text>
                  <Text style={styles.calloutHint}>Tap for details</Text>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>

      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Legend</Text>
        <Text style={styles.legendText}>Red: severe/active</Text>
        <Text style={styles.legendText}>Orange: elevated</Text>
        <Text style={styles.legendText}>Yellow: cooling down</Text>
        <Text style={styles.legendText}>Gray: resolved</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg
  },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm
  },
  muted: {
    color: colors.textMuted
  },
  topBar: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm
  },
  headerTextWrap: {
    gap: 4
  },
  heading: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800"
  },
  subheading: {
    color: colors.textMuted,
    lineHeight: 18
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.md
  },
  primaryButton: {
    backgroundColor: colors.primary
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border
  },
  primaryButtonText: {
    color: colors.text,
    fontWeight: "700"
  },
  secondaryButtonText: {
    color: colors.textSoft,
    fontWeight: "700"
  },
  errorBox: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: "#2a0f14",
    borderWidth: 1,
    borderColor: "#7f1d1d",
    borderRadius: radius.lg,
    padding: spacing.md
  },
  errorTitle: {
    color: "#fecaca",
    fontWeight: "700",
    marginBottom: 4
  },
  errorText: {
    color: "#fca5a5"
  },
  map: {
    flex: 1
  },
  callout: {
    width: 220,
    padding: 4
  },
  calloutTitle: {
    fontWeight: "700",
    marginBottom: 4
  },
  calloutText: {
    fontSize: 12,
    marginBottom: 2
  },
  calloutHint: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary
  },
  legend: {
    position: "absolute",
    bottom: spacing.lg,
    left: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 4
  },
  legendTitle: {
    color: colors.text,
    fontWeight: "700",
    marginBottom: 2
  },
  legendText: {
    color: colors.textMuted,
    fontSize: 12
  }
});