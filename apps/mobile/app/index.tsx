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
import { colors, radius, spacing, shadows } from "../src/styles/theme";
import { FeedItem, UserProfile, AlertItem } from "../src/types/api";

const POLL_INTERVAL_MS = 15000;

export default function FeedScreen() {
  const { user, loading: authLoading } = useAuthUser();

  const [items, setItems] = useState<FeedItem[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

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

  const realtimeLabel =
    realtimeStatus === "connected"
      ? "Live"
      : realtimeStatus === "connecting"
      ? "Connecting"
      : "Disconnected";

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
        ListHeaderComponent={
          <>
            <View style={styles.heroCard}>
              <View style={styles.heroTopRow}>
                <View style={styles.heroTextWrap}>
                  <Text style={styles.eyebrow}>Realtime incident intelligence</Text>
                  <Text style={styles.heading}>CrowdLens</Text>
                  <Text style={styles.subheading}>
                    Monitor high-priority events ranked by severity, confidence, freshness, and momentum.
                  </Text>
                </View>

                <View
                  style={[
                    styles.livePill,
                    realtimeStatus === "connected" && styles.livePillConnected,
                    realtimeStatus === "connecting" && styles.livePillConnecting,
                    realtimeStatus === "disconnected" && styles.livePillDisconnected,
                  ]}
                >
                  <Text style={styles.livePillText}>{realtimeLabel}</Text>
                </View>
              </View>

              {user?.email ? (
                <Text style={styles.userText}>Signed in as {user.email}</Text>
              ) : null}

              {profile ? (
                <View style={styles.profileMetaRow}>
                  <View style={styles.metaChip}>
                    <Text style={styles.metaChipText}>Reputation {profile.reputation_score}</Text>
                  </View>
                  <View style={styles.metaChip}>
                    <Text style={styles.metaChipText}>Reports {profile.total_reports}</Text>
                  </View>
                  <View style={styles.metaChip}>
                    <Text style={styles.metaChipText}>Unique {profile.unique_reports}</Text>
                  </View>
                </View>
              ) : null}

              <View style={styles.actionRow}>
                <Link href="/report" asChild>
                  <Pressable style={[styles.button, styles.primaryButton]}>
                    <Text style={styles.primaryButtonText}>New Report</Text>
                  </Pressable>
                </Link>

                <Link href="/map" asChild>
                  <Pressable style={[styles.button, styles.secondaryButton]}>
                    <Text style={styles.secondaryButtonText}>Open Map</Text>
                  </Pressable>
                </Link>

                <Pressable style={[styles.button, styles.ghostButton]} onPress={handleLogout}>
                  <Text style={styles.ghostButtonText}>Logout</Text>
                </Pressable>
              </View>

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
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Alerts</Text>
                  <Text style={styles.sectionSubtitle}>Priority incidents that need attention now</Text>
                </View>

                {alerts.slice(0, 3).map((alert) => (
                  <Pressable
                    key={alert.event.id}
                    style={styles.alertCard}
                    onPress={() => router.push(`/event/${alert.event.id}`)}
                  >
                    <View style={styles.alertAccent} />
                    <View style={styles.alertContent}>
                      <Text style={styles.alertLabel}>BREAKING</Text>
                      <Text style={styles.alertTitle}>{alert.event.title}</Text>
                      <Text style={styles.alertReason}>{alert.reason}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Feed</Text>
              <Text style={styles.sectionSubtitle}>Latest ranked incidents across the platform</Text>
            </View>
          </>
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
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.card,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  heroTextWrap: {
    flex: 1,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  heading: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -0.6,
  },
  subheading: {
    color: colors.textMuted,
    marginTop: 8,
    lineHeight: 20,
    fontSize: 14,
    maxWidth: "95%",
  },
  livePill: {
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  livePillConnected: {
    backgroundColor: colors.successSoft,
  },
  livePillConnecting: {
    backgroundColor: colors.warningSoft,
  },
  livePillDisconnected: {
    backgroundColor: colors.dangerSoft,
  },
  livePillText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  userText: {
    color: colors.textSoft,
    marginTop: spacing.md,
    fontSize: 13,
  },
  profileMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  metaChip: {
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  metaChipText: {
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: "700",
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  button: {
    minHeight: 42,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  secondaryButton: {
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ghostButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: "800",
    fontSize: 13,
  },
  secondaryButtonText: {
    color: colors.textSoft,
    fontWeight: "800",
    fontSize: 13,
  },
  ghostButtonText: {
    color: colors.textMuted,
    fontWeight: "700",
    fontSize: 13,
  },
  pollingText: {
    color: colors.textDim,
    fontSize: 12,
    marginTop: spacing.sm,
  },
  alertsSection: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  sectionHeader: {
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  alertCard: {
    flexDirection: "row",
    backgroundColor: "#1a1114",
    borderWidth: 1,
    borderColor: "#462027",
    borderRadius: radius.lg,
    overflow: "hidden",
    ...shadows.card,
  },
  alertAccent: {
    width: 5,
    backgroundColor: colors.danger,
  },
  alertContent: {
    flex: 1,
    padding: spacing.md,
  },
  alertLabel: {
    color: "#fca5a5",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  alertTitle: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 15,
  },
  alertReason: {
    color: "#fca5a5",
    marginTop: 6,
    lineHeight: 18,
    fontSize: 13,
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
  errorBox: {
    backgroundColor: "#2a0f14",
    borderWidth: 1,
    borderColor: "#7f1d1d",
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorTitle: {
    color: "#fecaca",
    fontWeight: "800",
    marginBottom: 4,
  },
  errorText: {
    color: "#fca5a5",
    lineHeight: 18,
  },
  emptyBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginTop: spacing.lg,
    ...shadows.card,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 6,
  },
  emptyText: {
    color: colors.textMuted,
    lineHeight: 20,
  },
});