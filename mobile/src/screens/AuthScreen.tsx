import Ionicons from "@expo/vector-icons/Ionicons";
import * as Google from "expo-auth-session/providers/google";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  SafeAreaView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  GOOGLE_ANDROID_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
} from "../config";
import { useAuth } from "../hooks/useAuth";
import { useSettings } from "../settings";
import { localizedFontSize, type ThemeColors } from "../theme";

type AuthView = "login" | "signup";

/** Platform-specific Google OAuth client ID (native client types only). */
const GOOGLE_CLIENT_ID =
  Platform.OS === "ios" ? GOOGLE_IOS_CLIENT_ID : GOOGLE_ANDROID_CLIENT_ID;

export default function AuthScreen() {
  const { colors, t } = useSettings();
  const { login, signup, signInWithGoogle, continueAsGuest } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets), [colors, insets]);

  const [view, setView] = useState<AuthView>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Google Sign-In: use authorization code flow with PKCE (required for native clients).
  // Expo handles the code exchange via its proxy and returns authentication.idToken.
  const [googleRequest, googleResponse, promptGoogle] = Google.useAuthRequest({
    clientId: GOOGLE_CLIENT_ID || undefined,
    scopes: ["openid", "email", "profile"],
  });

  useEffect(() => {
    if (!googleResponse) return;
    setGoogleLoading(false);
    if (googleResponse.type === "success") {
      // Expo's PKCE code exchange puts the idToken in authentication.idToken
      const idToken = googleResponse.authentication?.idToken;
      if (!idToken) {
        setError(t.auth.googleFailed);
        return;
      }
      signInWithGoogle(idToken).then((result) => {
        if (result.error) setError(result.error);
      });
    } else if (googleResponse.type === "error") {
      setError(t.auth.googleFailed);
    }
    // "dismissed" = user closed the sheet → nothing to show.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleResponse]);

  const onGooglePress = () => {
    if (!GOOGLE_CLIENT_ID) {
      setError(t.auth.googleNotConfigured);
      return;
    }
    // promptAsync() is a silent no-op until the request has loaded —
    // surface it instead (usually means the native build is outdated).
    if (!googleRequest) {
      setError(t.auth.googleFailed);
      return;
    }
    setError(null);
    setGoogleLoading(true);
    promptGoogle();
  };

  const reset = () => {
    setUsername("");
    setPassword("");
    setConfirmPassword("");
    setError(null);
  };

  const goToSignup = () => {
    reset();
    setView("signup");
  };

  const goToLogin = () => {
    reset();
    setView("login");
  };

  const onSubmit = async () => {
    setLoading(true);
    setError(null);

    if (view === "signup" && password !== confirmPassword) {
      setError(t.auth.passwordMismatch);
      setLoading(false);
      return;
    }

    const fn = view === "login" ? login : signup;
    const result = await fn(username, password);
    if (result.error) {
      setError(result.error);
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={insets.top}
      >
        <Pressable style={styles.container} onPress={() => Keyboard.dismiss()}>
          {/* ── Light green decorative layer behind header ── */}
          <View style={styles.headerBg} />

          {/* ── Back arrow (signup only) ── */}
          {view === "signup" && (
            <Pressable style={styles.backBtn} onPress={goToLogin}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </Pressable>
          )}

          {/* ── Header / brand area (dark green) ── */}
          <View style={styles.header}>
            <View style={styles.logo}>
              <Ionicons name="leaf" size={30} color="#fff" />
            </View>
            <Text style={styles.appName}>FarmBot</Text>
            <Text style={styles.subtitle}>
              {view === "login" ? t.auth.loginSubtitle : t.auth.signupSubtitle}
            </Text>
          </View>

          {/* ── Form area (light green) ── */}
          <View style={styles.formArea}>
            <View style={styles.formInner}>
              {error && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={14} color={colors.danger} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <Text style={styles.label}>{t.auth.username}</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder={t.auth.usernamePlaceholder}
                placeholderTextColor={colors.mutedLight}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.label}>{t.auth.password}</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder={t.auth.passwordPlaceholder}
                placeholderTextColor={colors.mutedLight}
                secureTextEntry
              />

              {view === "signup" && (
                <>
                  <Text style={styles.label}>{t.auth.confirmPassword}</Text>
                  <TextInput
                    style={styles.input}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder={t.auth.confirmPasswordPlaceholder}
                    placeholderTextColor={colors.mutedLight}
                    secureTextEntry
                  />
                </>
              )}

              <Pressable
                style={[styles.primaryBtn, loading && styles.disabled]}
                onPress={onSubmit}
                disabled={loading}
              >
                <Text style={styles.primaryBtnText}>
                  {view === "login" ? t.auth.login : t.auth.signup}
                </Text>
              </Pressable>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>{t.auth.or}</Text>
                <View style={styles.dividerLine} />
              </View>

              <Pressable
                style={[styles.googleBtn, googleLoading && styles.disabled]}
                onPress={onGooglePress}
                disabled={googleLoading || loading}
              >
                {googleLoading ? (
                  <ActivityIndicator size="small" color="#4285F4" />
                ) : (
                  <Ionicons name="logo-google" size={18} color="#4285F4" />
                )}
                <Text style={styles.googleBtnText}>
                  {t.auth.continueWithGoogle}
                </Text>
              </Pressable>

              <Pressable style={styles.guestBtn} onPress={continueAsGuest}>
                <Ionicons name="person-outline" size={16} color={colors.muted} />
                <Text style={styles.guestBtnText}>{t.auth.guestContinue}</Text>
              </Pressable>

              {view === "login" && (
                <Pressable style={styles.switchBtn} onPress={goToSignup}>
                  <Text style={styles.switchText}>
                    {t.auth.noAccount}{" "}
                    <Text style={styles.switchBold}>{t.auth.signup}</Text>
                  </Text>
                </Pressable>
              )}

              {/* Bottom spacer for home indicator */}
              <View style={styles.bottomSpacer} />
            </View>
          </View>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors, insets: { top: number; bottom: number }) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.activeBg,
    },
    flex: { flex: 1 },
    container: {
      flex: 1,
      backgroundColor: colors.activeBg,
    },
    headerBg: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 245 + insets.top,
      zIndex: -1,
      backgroundColor: colors.activeBg,
    },
    /* ── Brand header (dark green) ── */
    header: {
      backgroundColor: colors.primary,
      paddingTop: 56 + insets.top,
      paddingBottom: 28,
      paddingHorizontal: 24,
      alignItems: "center",
    },
    backBtn: {
      position: "absolute",
      top: 24 + insets.top,
      left: 16,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.bg,
      alignItems: "center",
      justifyContent: "center",
      zIndex: 10,
      cursor: "pointer",
    },
    logo: {
      width: 60,
      height: 60,
      borderRadius: 18,
      backgroundColor: "rgba(255,255,255,0.2)",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },
    appName: {
      fontSize: localizedFontSize(24, "en"),
      fontWeight: "800",
      color: "#fff",
    },
    subtitle: {
      fontSize: localizedFontSize(13, "en"),
      color: "rgba(255,255,255,0.75)",
      marginTop: 4,
    },
    /* ── Form area (light green) ── */
    formArea: {
      flex: 1,
      backgroundColor: colors.activeBg,
      borderTopLeftRadius: 40,
      borderTopRightRadius: 40,
      zIndex: 1,
    },
    formInner: {
      flex: 1,
      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: insets.bottom + 24,
    },
    label: {
      fontSize: localizedFontSize(12, "en"),
      fontWeight: "600",
      color: colors.textDark,
      marginBottom: 5,
      marginTop: 4,
    },
    input: {
      backgroundColor: colors.white,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      height: 46,
      lineHeight: 20,
      fontSize: localizedFontSize(14, "en"),
      color: colors.textDark,
      marginBottom: 10,
      textAlignVertical: "center",
      includeFontPadding: false,
    },
    errorBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "rgba(178,59,59,0.1)",
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 7,
      marginBottom: 12,
    },
    errorText: {
      flex: 1,
      fontSize: localizedFontSize(12, "en"),
      color: colors.danger,
    },
    primaryBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      height: 46,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 6,
      cursor: "pointer",
    },
    disabled: { opacity: 0.5 },
    primaryBtnText: {
      color: "#fff",
      fontSize: localizedFontSize(15, "en"),
      fontWeight: "700",
    },
    divider: {
      flexDirection: "row",
      alignItems: "center",
      marginVertical: 14,
    },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
    dividerText: {
      marginHorizontal: 10,
      fontSize: localizedFontSize(11, "en"),
      color: colors.muted,
    },
    googleBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      height: 46,
      backgroundColor: colors.white,
      cursor: "pointer",
    },
    googleBtnText: {
      fontSize: localizedFontSize(14, "en"),
      fontWeight: "600",
      color: colors.textDark,
    },
    guestBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderRadius: 12,
      height: 42,
      marginTop: 10,
      cursor: "pointer",
    },
    guestBtnText: {
      fontSize: localizedFontSize(13, "en"),
      fontWeight: "600",
      color: colors.muted,
    },
    switchBtn: {
      alignItems: "center",
      marginTop: 16,
      cursor: "pointer",
    },
    switchText: {
      fontSize: localizedFontSize(13, "en"),
      color: colors.muted,
    },
    switchBold: {
      fontWeight: "700",
      color: colors.textDark,
    },
    bottomSpacer: {
      height: Math.max(insets.bottom, 20),
    },
  });
