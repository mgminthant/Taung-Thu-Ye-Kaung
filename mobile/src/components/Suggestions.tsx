/**
 * Suggestions — the "Try asking" chips shown when a chat is still empty.
 */
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useSettings } from "../settings";
import type { ThemeColors } from "../theme";

type Props = {
  onSelect: (question: string) => void;
  disabled: boolean;
};

export default function Suggestions({ onSelect, disabled }: Props) {
  const { colors, t } = useSettings();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{t.suggestions.tryAsking}</Text>
      {t.suggestions.questions.map((q) => (
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

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
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
