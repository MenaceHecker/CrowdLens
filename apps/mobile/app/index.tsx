import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useFocusEffect, router } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View
} from "react-native";

import { getFeed, getMe, getAlerts } from "../src/api/client";
import { WS_BASE } from "../src/api/config";
import { logout } from "../src/auth";
import { useAuthUser } from "../src/useAuthUser";
import { EventCard } from "../src/components/EventCard";
import { colors, radius, spacing } from "../src/styles/theme";
import { FeedItem, UserProfile, AlertItem } from "../src/types/api";

const POLL_INTERVAL_MS = 15000;

export default function FeedScreen() {
  const { user, loading: authLoading } = useAuthUser();

  const [items, setItems] = useState<FeedItem[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  const loadFeed = async (silent = false) => {
    try {
      if (!silent) {
        setError(null);
      }

      const [feed, meData, alertItems] = await Promise.all([
        getFeed(),
        getMe(),
        getAlerts(),
      ]);

      setItems(feed);
      setProfile(meData.profile);
      setAlerts(alertItems);

      if (!silent) {
        setError(null);
      }
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : "Failed to load feed");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const disconnectWebSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setRealtimeStatus("disconnected");
  }, []);

  const connectWebSocket = useCallback(() => {
    disconnectWebSocket();
    setRealtimeStatus("connecting");

    const ws = new WebSocket(`${WS_BASE}/ws/feed`);
    socketRef.current = ws;

    ws.onopen = () => {
      setRealtimeStatus("connected");
    };

    ws.onmessage = async (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "feed_updated") {
          await loadFeed(true);
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onerror = () => {
      setRealtimeStatus("disconnected");
    };

    ws.onclose = () => {
      setRealtimeStatus("disconnected");
      socketRef.current = null;
    };
  }, [disconnectWebSocket]);

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

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      router.replace("/auth");
      return;
    }

    loadFeed();
    startPolling();
    connectWebSocket();

    return () => {
      stopPolling();
      disconnectWebSocket();
    };
  }, [user, authLoading, startPolling, stopPolling, connectWebSocket, disconnectWebSocket]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;

      loadFeed(true);
      startPolling();
      connectWebSocket();

      return () => {
        stopPolling();
        disconnectWebSocket();
      };
    }, [user, startPolling, stopPolling, connectWebSocket, disconnectWebSocket])
  );

  const handleLogout = async () => {
    await logout();
    router.replace("/auth");
  };

  if (authLoading || loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.muted}>Loading feed...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.heading}>Live Incident Feed</Text>
          <Text style={styles.subheading}>
            Ranked by severity, confidence, freshness, and velocity
          </Text>

          {user?.email ? (
            <Text style={styles.userText}>Signed in as {user.email}</Text>
          ) : null}

          {profile ? (
            <Text style={styles.uidText}>
              Reputation: {profile.reputation_score} · Reports: {profile.total_reports} · Unique: {profile.unique_reports}
            </Text>
          ) : null}
        </View>

        <View style={styles.actionRow}>
          <Link href="/report" asChild>
            <Pressable style={[styles.button, styles.primaryButton]}>
              <Text style={styles.buttonText}>+ Report</Text>
            </Pressable>
          </Link>

          <Link href="/map" asChild>
            <Pressable style={[styles.button, styles.secondaryButton]}>
              <Text style={styles.buttonTextSecondary}>Open Map</Text>
            </Pressable>
          </Link>

          <Pressable style={[styles.button, styles.secondaryButton]} onPress={handleLogout}>
            <Text style={styles.buttonTextSecondary}>Logout</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.realtimeBox}>
        <Text style={styles.realtimeText}>
          Realtime: {realtimeStatus === "connected"
            ? "connected"
            : realtimeStatus === "connecting"
            ? "connecting..."
            : "disconnected"}
        </Text>
        <Text style={styles.pollingText}>Polling fallback every 15 seconds</Text>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Couldn’t load the feed</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {alerts.length > 0 ? (
        <View style={styles.alertsSection}>
          <Text style={styles.sectionTitle}>Alerts</Text>
          {alerts.slice(0, 3).map((alert) => (
            <Pressable
              key={alert.event.id}
              style={styles.alertCard}
              onPress={() => router.push(`/event/${alert.event.id}`)}
            >
              <Text style={styles.alertTitle}>{alert.event.title}</Text>
              <Text style={styles.alertReason}>{alert.reason}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <FlatList
        data={items}
        keyExtractor={(item) => item.event.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadFeed();
            }}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>No incidents yet</Text>
            <Text style={styles.emptyText}>
              Submit a report to create the first event in the feed.
            </Text>
          </View>
        }
        renderItem={({ item }) => <EventCard item={item} />}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md
  },
  listContent: {
    paddingBottom: spacing.xl
  },
  alertsSection: {
    marginBottom: spacing.md,
    gap: spacing.sm
  },
  topBar: {
    marginBottom: spacing.md,
    gap: spacing.sm
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800"
  },
  alertCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4
  },
  alertTitle: {
    color: colors.text,
    fontWeight: "700"
  },
  alertReason: {
    color: colors.textMuted,
    lineHeight: 18
  },
  heading: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800"
  },
  subheading: {
    color: colors.textMuted,
    marginTop: 4,
    lineHeight: 18
  },
  userText: {
    color: colors.textSoft,
    marginTop: 8
  },
  uidText: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm
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
  buttonText: {
    color: colors.text,
    fontWeight: "700"
  },
  buttonTextSecondary: {
    color: colors.textSoft,
    fontWeight: "700"
  },
  realtimeBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md
  },
  realtimeText: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: "700"
  },
  pollingText: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2
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
  errorBox: {
    backgroundColor: "#2a0f14",
    borderWidth: 1,
    borderColor: "#7f1d1d",
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md
  },
  errorTitle: {
    color: "#fecaca",
    fontWeight: "700",
    marginBottom: 4
  },
  errorText: {
    color: "#fca5a5"
  },
  emptyBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginTop: spacing.lg
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6
  },
  emptyText: {
    color: colors.textMuted,
    lineHeight: 20
  }
});
