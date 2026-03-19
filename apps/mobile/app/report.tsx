import { useState } from "react";
import { router } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";

import { createReport, createUploadUrl, processNextJob } from "../src/api/client";
import { colors, radius, spacing } from "../src/styles/theme";

export default function ReportScreen() {
  const [text, setText] = useState("");
  const [lat, setLat] = useState("33.7756");
  const [lng, setLng] = useState("-84.3963");
  const [submitting, setSubmitting] = useState(false);
  const [submitAndProcess, setSubmitAndProcess] = useState(false);
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaName, setMediaName] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<string | null>(null);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Media library permission is required.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      setMediaUri(asset.uri);
      setMediaName(asset.fileName ?? `upload-${Date.now()}.jpg`);
      setMediaType(asset.mimeType ?? "application/octet-stream");
    }
  };

  const uploadMediaIfPresent = async (): Promise<string | null> => {
    if (!mediaUri || !mediaName || !mediaType) {
      return null;
    }

    const signed = await createUploadUrl({
      filename: mediaName,
      content_type: mediaType,
    });

    const uploadResponse = await FileSystem.uploadAsync(signed.upload_url, mediaUri, {
      httpMethod: "PUT",
      headers: {
        "Content-Type": signed.content_type,
      },
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    });

    if (uploadResponse.status < 200 || uploadResponse.status >= 300) {
      throw new Error(`Media upload failed: ${uploadResponse.status}`);
    }

    return signed.object_path;
  };

  const submit = async (alsoProcess: boolean) => {
    if (!text.trim()) {
      Alert.alert("Missing text", "Please enter a report.");
      return;
    }

    try {
      setSubmitting(true);
      setSubmitAndProcess(alsoProcess);

      const mediaPath = await uploadMediaIfPresent();

      await createReport({
        text: text.trim(),
        location: {
          lat: Number(lat),
          lng: Number(lng)
        },
        media_path: mediaPath,
      });

      if (alsoProcess) {
        await processNextJob();
        Alert.alert("Success", "Report submitted and one queued job was processed.");
      } else {
        Alert.alert("Report submitted", "Your report was queued successfully.");
      }

      router.replace("/");
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to submit report");
    } finally {
      setSubmitting(false);
      setSubmitAndProcess(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Submit Incident Report</Text>
      <Text style={styles.subheading}>
        Send a local test report to the CrowdLens backend.
      </Text>

      <View style={styles.devNotice}>
        <Text style={styles.devNoticeTitle}>Media upload enabled</Text>
        <Text style={styles.devNoticeText}>
          Attach a photo or video, then submit the report.
        </Text>
      </View>

      <Text style={styles.label}>What did you observe?</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Describe what you observed..."
        placeholderTextColor={colors.textMuted}
        multiline
        value={text}
        onChangeText={setText}
      />

      <Pressable style={[styles.button, styles.secondaryButton]} onPress={pickImage}>
        <Text style={styles.secondaryButtonText}>
          {mediaName ? `Attached: ${mediaName}` : "Attach Photo / Video"}
        </Text>
      </Pressable>

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

      <View style={styles.actions}>
        <Pressable
          style={[styles.button, styles.secondaryButton]}
          onPress={() => submit(false)}
          disabled={submitting}
        >
          <Text style={styles.secondaryButtonText}>
            {submitting && !submitAndProcess ? "Submitting..." : "Submit Only"}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.button, styles.primaryButton]}
          onPress={() => submit(true)}
          disabled={submitting}
        >
          <Text style={styles.primaryButtonText}>
            {submitting && submitAndProcess ? "Submitting..." : "Submit & Process Locally"}
          </Text>
        </Pressable>
      </View>
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
  devNotice: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md
  },
  devNoticeTitle: {
    color: colors.text,
    fontWeight: "700",
    marginBottom: 4
  },
  devNoticeText: {
    color: colors.textMuted,
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
  actions: {
    marginTop: spacing.xl,
    gap: spacing.sm
  },
  button: {
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: "center",
    paddingHorizontal: 12,
  },
  primaryButton: {
    backgroundColor: colors.primary
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border
  },
  primaryButtonText: {
    color: colors.text,
    fontWeight: "800"
  },
  secondaryButtonText: {
    color: colors.textSoft,
    fontWeight: "800"
  }
});