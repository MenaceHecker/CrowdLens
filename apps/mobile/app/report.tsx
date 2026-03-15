import { useState } from "react";
import { router } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { createReport } from "../src/api/client";

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

      Alert.alert("Success", "Report submitted.");
      router.replace("/");
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Report Text</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Describe what you observed..."
        placeholderTextColor="#64748b"
        multiline
        value={text}
        onChangeText={setText}
      />

      <Text style={styles.label}>Latitude</Text>
      <TextInput
        style={styles.input}
        value={lat}
        onChangeText={setLat}
        keyboardType="numeric"
        placeholderTextColor="#64748b"
      />

      <Text style={styles.label}>Longitude</Text>
      <TextInput
        style={styles.input}
        value={lng}
        onChangeText={setLng}
        keyboardType="numeric"
        placeholderTextColor="#64748b"
      />

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
    padding: 16,
    backgroundColor: "#0b1220"
  },
  label: {
    color: "#e5e7eb",
    marginBottom: 6,
    marginTop: 12
  },
  input: {
    backgroundColor: "#111827",
    color: "#fff",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1f2937"
  },
  textArea: {
    height: 140,
    textAlignVertical: "top"
  },
  button: {
    marginTop: 20,
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center"
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700"
  }
});
