import { useCallback, useEffect, useState } from "react";
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

import { getFeed } from "../src/api/client";
import { EventCard } from "../src/components/EventCard";
import { colors, radius, spacing } from "../src/styles/theme";
import { FeedItem } from "../src/types/api";

export default function FeedScreen() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFeed = async () => {
    try {
      setError(null);
      const data = await getFeed();
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load feed");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadFeed();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadFeed();
    }, [])
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
          <Text style={styles.subheading}>Ranked by severity, confidence, freshness, and velocity</Text>
        </View>

        <Link href="/report" asChild>
          <Pressable style={styles.button}>
            <Text style={styles.buttonText}>+ Report</Text>
          </Pressable>
        </Link>
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
  button: {
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.md
  },
  buttonText: {
    color: colors.text,
    fontWeight: "700"
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