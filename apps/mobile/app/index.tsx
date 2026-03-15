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