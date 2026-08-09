/**
 * Suggestions — the "Try asking" chips shown when a chat is still empty.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";

import { SUGGESTED_QUESTIONS } from "../config";
import { colors } from "../theme";

type Props = {
  onSelect: (question: string) => void;
  disabled: boolean;
};

export default function Suggestions({ onSelect, disabled }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Try asking</Text>
      {SUGGESTED_QUESTIONS.map((q) => (
        <Pressable
          key={q}
          style={styles.chip}
          onPress={() => onSelect(q)}
          disabled={disabled}
        >
          <Text style={styles.chipText}>{q}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginBottom: 12 },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
  },
  chip: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    cursor: "pointer",
  },
  chipText: { color: colors.textDark, fontSize: 14 },
});
