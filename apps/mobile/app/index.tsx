import { useEffect, useState } from "react";
import { Link } from "expo-router";
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
      <Link href="/report" asChild>
        <Pressable style={styles.button}>
          <Text style={styles.buttonText}>Submit Report</Text>
        </Pressable>
      </Link>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={items}
        keyExtractor={(item) => item.event.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {
          setRefreshing(true);
          loadFeed();
        }} />}
        ListEmptyComponent={<Text style={styles.muted}>No events yet.</Text>}
        renderItem={({ item }) => (
          <Link href={`/event/${item.event.id}`} asChild>
            <Pressable style={styles.card}>
              <Text style={styles.title}>{item.event.title}</Text>
              <Text style={styles.meta}>
                Status: {item.event.status} · Trend: {item.event.trend}
              </Text>
              <Text style={styles.meta}>
                Severity: {item.event.severity} · Confidence: {item.event.confidence}
              </Text>
              <Text style={styles.meta}>
                Unique: {item.event.unique_report_count} · Duplicates: {item.event.duplicate_report_count}
              </Text>
              <Text style={styles.meta}>
                Ranking: {item.event.ranking_score} · Recent: {String(item.event.is_recent)}
              </Text>
              <Text style={styles.summary} numberOfLines={3}>
                {item.event.briefing?.summary ?? "No briefing available."}
              </Text>
            </Pressable>
          </Link>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 12
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12
  },
  button: {
    backgroundColor: "#2563eb",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600"
  },
  card: {
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1f2937"
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6
  },
  meta: {
    color: "#cbd5e1",
    fontSize: 13,
    marginBottom: 4
  },
  summary: {
    color: "#e5e7eb",
    marginTop: 8,
    lineHeight: 20
  },
  muted: {
    color: "#94a3b8"
  },
  error: {
    color: "#f87171"
  }
});