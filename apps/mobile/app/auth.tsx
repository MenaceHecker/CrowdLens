import { useState } from "react";
import { router } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { loginWithEmail, registerWithEmail } from "../src/auth";
import { colors, radius, spacing } from "../src/styles/theme";

export default function AuthScreen() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    try {
      setLoading(true);

      if (mode === "login") {
        await loginWithEmail(email.trim(), password);
      } else {
        await registerWithEmail(email.trim(), password);
      }

      router.replace("/");
    } catch (err) {
      Alert.alert("Auth error", err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>CrowdLens Auth</Text>
      <Text style={styles.subheading}>
        Sign in to submit authenticated reports.
      </Text>

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        placeholder="you@example.com"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <Text style={styles.label}>Password</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter password"
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Pressable style={[styles.button, styles.primaryButton]} onPress={submit} disabled={loading}>
        <Text style={styles.primaryButtonText}>
          {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
        </Text>
      </Pressable>

      <Pressable
        style={[styles.button, styles.secondaryButton]}
        onPress={() => setMode(mode === "login" ? "register" : "login")}
      >
        <Text style={styles.secondaryButtonText}>
          {mode === "login" ? "Need an account? Register" : "Already have an account? Sign in"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: spacing.md,
    justifyContent: "center",
  },
  heading: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 6,
  },
  subheading: {
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  label: {
    color: colors.textSoft,
    marginBottom: 6,
    marginTop: 10,
    fontWeight: "600",
  },
  input: {
    backgroundColor: colors.surface,
    color: colors.text,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    marginTop: spacing.md,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: "center",
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  primaryButtonText: {
    color: colors.text,
    fontWeight: "800",
  },
  secondaryButtonText: {
    color: colors.textSoft,
    fontWeight: "700",
  },
});