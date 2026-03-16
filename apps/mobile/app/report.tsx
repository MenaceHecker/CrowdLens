import { useState } from "react";
import { router } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { createReport } from "../src/api/client";
import { colors, radius, spacing } from "../src/styles/theme";

export default function ReportScreen() {
  const [text, setText] = useState("");
  const [lat, setLat] = useState("33.7756");
  const [lng, setLng] = useState("-84.3963");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!text.trim()) {
      Alert.alert("Missing text", "Please enter a report.");
      return;
    }

    try {
      setSubmitting(true);

      await createReport({
        text: text.trim(),
        location: {
          lat: Number(lat),
          lng: Number(lng)
        }
      });

      Alert.alert(
        "Report submitted",
        "Your report was queued successfully. Run the worker locally to process it."
      );
      router.replace("/");
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Submit Incident Report</Text>
      <Text style={styles.subheading}>
        Send a local test report to the CrowdLens backend.
      </Text>

      <Text style={styles.label}>What did you observe?</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Describe what you observed..."
        placeholderTextColor={colors.textMuted}
        multiline
        value={text}
        onChangeText={setText}
      />

      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={styles.label}>Latitude</Text>
          <TextInput
            style={styles.input}
            value={lat}
            onChangeText={setLat}
            keyboardType="numeric"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <View style={styles.col}>
          <Text style={styles.label}>Longitude</Text>
          <TextInput
            style={styles.input}
            value={lng}
            onChangeText={setLng}
            keyboardType="numeric"
            placeholderTextColor={colors.textMuted}
          />
        </View>
      </View>

      <Pressable style={styles.button} onPress={onSubmit} disabled={submitting}>
        <Text style={styles.buttonText}>
          {submitting ? "Submitting..." : "Submit Report"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: spacing.md
  },
  heading: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 6
  },
  subheading: {
    color: colors.textMuted,
    marginBottom: spacing.lg,
    lineHeight: 20
  },
  label: {
    color: colors.textSoft,
    marginBottom: 6,
    marginTop: 10,
    fontWeight: "600"
  },
  input: {
    backgroundColor: colors.surface,
    color: colors.text,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border
  },
  textArea: {
    height: 140,
    textAlignVertical: "top"
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm
  },
  col: {
    flex: 1
  },
  button: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: "center"
  },
  buttonText: {
    color: colors.text,
    fontWeight: "800"
  }
});