import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";

import { createReport, getMediaUploadUrl } from "../src/api/client";
import { colors, radius, spacing } from "../src/styles/theme";

type PickedMedia = {
  uri: string;
  mimeType: string;
  filename: string;
};

export default function ReportScreen() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [media, setMedia] = useState<PickedMedia | null>(null);

  const handlePickMedia = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Permission required", "Please allow media library access.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsEditing: false,
      quality: 0.8
    });

    if (result.canceled) return;

    const asset = result.assets[0];

    setMedia({
      uri: asset.uri,
      mimeType: asset.mimeType || "application/octet-stream",
      filename: asset.fileName || `upload-${Date.now()}`
    });
  };

  const uploadMediaIfNeeded = async (): Promise<string | null> => {
    if (!media) return null;

    const bundle = await getMediaUploadUrl({
      filename: media.filename,
      content_type: media.mimeType
    });

    const fileResponse = await fetch(media.uri);
    const blob = await fileResponse.blob();

    const uploadResp = await fetch(bundle.upload_url, {
      method: "PUT",
      headers: {
        "Content-Type": bundle.content_type
      },
      body: blob
    });

    if (!uploadResp.ok) {
      throw new Error(`Media upload failed: ${uploadResp.status}`);
    }

    return bundle.view_url;
  };

  const handleSubmit = async () => {
    if (!text.trim()) {
      Alert.alert("Missing info", "Please describe the incident.");
      return;
    }

    try {
      setLoading(true);

      const mediaUrl = await uploadMediaIfNeeded();

      await createReport({
        text: text.trim(),
        location: {
          lat: 33.7756,
          lng: -84.3963
        },
        media_url: mediaUrl
      });

      Alert.alert("Report submitted", "Your report is being processed.");

      setText("");
      setMedia(null);
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

      <Pressable style={styles.secondaryButton} onPress={handlePickMedia}>
        <Text style={styles.secondaryButtonText}>
          {media ? "Change Attachment" : "Attach Image / Video"}
        </Text>
      </Pressable>

      {media ? (
        <View style={styles.previewBox}>
          <Text style={styles.previewLabel}>{media.filename}</Text>
          {media.mimeType.startsWith("image/") ? (
            <Image source={{ uri: media.uri }} style={styles.previewImage} />
          ) : (
            <Text style={styles.previewLabel}>Video selected</Text>
          )}
        </View>
      ) : null}

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
    borderColor: colors.border,
    textAlignVertical: "top"
  },
  button: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
    marginTop: spacing.md
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: "center"
  },
  secondaryButtonText: {
    color: colors.textSoft,
    fontWeight: "700"
  },
  disabled: {
    opacity: 0.6
  },
  buttonText: {
    color: "white",
    fontWeight: "700"
  },
  previewBox: {
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm
  },
  previewLabel: {
    color: colors.textSoft
  },
  previewImage: {
    width: "100%",
    height: 220,
    borderRadius: radius.md
  }
});