import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { router } from "expo-router";

import { createReport } from "../src/api/client";
import { colors, radius, spacing } from "../src/styles/theme";

export default function ReportScreen() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim()) {
      Alert.alert("Missing info", "Please describe the incident.");
      return;
    }

    try {
      setLoading(true);

      await createReport({
        text,
        location: {
          lat: 33.7756,
          lng: -84.3963
        }
      });

      Alert.alert("Report submitted", "Your report is being processed.");

      setText("");
      router.replace("/");
    } catch (err) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Failed to submit report"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Report an Incident</Text>

      <TextInput
        style={styles.input}
        placeholder="Describe what’s happening..."
        placeholderTextColor="#888"
        value={text}
        onChangeText={setText}
        multiline
      />

      <Pressable
        style={[styles.button, loading && styles.disabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.buttonText}>Submit Report</Text>
        )}
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
    marginBottom: spacing.md
  },
  input: {
    backgroundColor: colors.surface,
    color: colors.text,
    padding: spacing.md,
    borderRadius: radius.md,
    minHeight: 120,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border
  },
  button: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: "center"
  },
  disabled: {
    opacity: 0.6
  },
  buttonText: {
    color: "white",
    fontWeight: "700"
  }
});