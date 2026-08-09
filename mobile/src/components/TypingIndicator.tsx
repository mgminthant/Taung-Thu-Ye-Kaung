/**
 * TypingIndicator — the "Thinking…" bubble shown while the backend replies.
 */
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { colors } from "../theme";

export default function TypingIndicator() {
  return (
    <View style={[styles.bubble, styles.botBubble, styles.row]}>
      <ActivityIndicator size="small" color={colors.primary} />
      <Text style={styles.text}>Thinking…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
  text: { fontSize: 13, color: colors.muted },
});
