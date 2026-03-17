import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect} from "expo-router";
import {
  ActivityIndicator,
  Text,
  View
} from "react-native";
import { Region } from "react-native-maps";

import { getFeed, processNextJob } from "../src/api/client";
import { WS_BASE } from "../src/api/config";
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