import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

import { getEvent, getEventReports } from "../../src/api/client";
import { Event, Report } from "../../src/types/api";

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEvent = async () => {
    if (!id) return;

    try {
      setError(null);
      const [eventData, reportData] = await Promise.all([
        getEvent(id),
        getEventReports(id)
      ]);
      setEvent(eventData);
      setReports(reportData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load event");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvent();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.muted}>Loading event...</Text>
      </View>
    );
  }

  if (error || !event) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error ?? "Event not found"}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{event.title}</Text>
      <Text style={styles.meta}>Status: {event.status}</Text>
      <Text style={styles.meta}>Trend: {event.trend}</Text>
      <Text style={styles.meta}>Ranking: {event.ranking_score}</Text>
      <Text style={styles.meta}>Velocity/hr: {event.report_velocity_per_hour}</Text>
      <Text style={styles.meta}>Minutes since last report: {event.minutes_since_last_report}</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Briefing</Text>
        <Text style={styles.body}>{event.briefing?.summary ?? "No summary available."}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Recommended Actions</Text>
        {(event.briefing?.recommended_actions ?? []).map((action) => (
          <Text key={action} style={styles.body}>• {action}</Text>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Source Reports</Text>
        {reports.map((report) => (
          <View key={report.id} style={styles.reportItem}>
            <Text style={styles.body}>{report.text}</Text>
            <Text style={styles.reportMeta}>
              duplicate: {String(report.is_duplicate)}
              {report.duplicate_of ? ` · duplicate_of: ${report.duplicate_of}` : ""}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}