/**
 * TypingIndicator — the "Thinking…" bubble shown while the backend replies.
 */
import { useMemo } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { useSettings } from "../settings";
import type { Lang } from "../i18n";
import { localizedFontSize, type ThemeColors } from "../theme";

export default function TypingIndicator() {
  const { colors, t, lang } = useSettings();
  const styles = useMemo(() => createStyles(colors, lang), [colors, lang]);

  return (
    <View style={[styles.bubble, styles.botBubble, styles.row]}>
      <ActivityIndicator size="small" color={colors.primary} />
      <Text style={styles.text}>{t.typing.thinking}</Text>
    </View>
  );
}

const createStyles = (colors: ThemeColors, lang: Lang) =>
  StyleSheet.create({
    bubble: {
      maxWidth: "92%",
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    botBubble: {
      alignSelf: "flex-start",
      backgroundColor: colors.white,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      alignSelf: "flex-start",
      paddingVertical: 12,
      marginBottom: 10,
    },
    text: {
      fontSize: localizedFontSize(13, lang),
      color: colors.muted,
    },
  });
