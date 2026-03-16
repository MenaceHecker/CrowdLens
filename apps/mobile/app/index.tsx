import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View
} from "react-native";

import { getFeed, processNextJob } from "../src/api/client";
import { EventCard } from "../src/components/EventCard";
import { colors, radius, spacing } from "../src/styles/theme";
import { FeedItem } from "../src/types/api";

const POLL_INTERVAL_MS = 8000;

export default function FeedScreen() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingJob, setProcessingJob] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
        setError(err instanceof Error ? err.message : "Failed to load feed");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

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

    return () => {
      stopPolling();
    };
  }, [startPolling, stopPolling]);

  useFocusEffect(
    useCallback(() => {
      loadFeed(true);
      startPolling();

      return () => {
        stopPolling();
      };
    }, [startPolling, stopPolling])
  );

  if (loading) {
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
        </View>

        <View style={styles.actionRow}>
          <Link href="/report" asChild>
            <Pressable style={[styles.button, styles.primaryButton]}>
              <Text style={styles.buttonText}>+ Report</Text>
            </Pressable>
          </Link>

          <Pressable
            style={[styles.button, styles.secondaryButton]}
            onPress={handleProcessNext}
            disabled={processingJob}
          >
            <Text style={styles.buttonTextSecondary}>
              {processingJob ? "Processing..." : "Process Next Job"}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.pollingBox}>
        <Text style={styles.pollingText}>Auto-refresh: every 8 seconds</Text>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Couldn’t load the feed</Text>
          <Text style={styles.errorText}>{error}</Text>
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
  topBar: {
    marginBottom: spacing.md,
    gap: spacing.sm
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
  pollingBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md
  },
  pollingText: {
    color: colors.textMuted,
    fontSize: 12
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