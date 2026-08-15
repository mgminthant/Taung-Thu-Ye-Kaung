/**
 * Suggestions — the "Try asking" chips shown when a chat is still empty.
 */
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useSettings } from "../settings";
import type { Lang } from "../i18n";
import { localizedFontSize, type ThemeColors } from "../theme";

type Props = {
  onSelect: (question: string) => void;
  disabled: boolean;
};

export default function Suggestions({ onSelect, disabled }: Props) {
  const { colors, t, lang } = useSettings();
  const styles = useMemo(() => createStyles(colors, lang), [colors, lang]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label} numberOfLines={1}>
        {t.suggestions.tryAsking}
      </Text>
      {t.suggestions.questions.map((q) => (
        <Pressable
          key={q}
          style={styles.chip}
          onPress={() => onSelect(q)}
          disabled={disabled}
        >
          <Text style={styles.chipText} numberOfLines={2}>
            {q}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const createStyles = (colors: ThemeColors, lang: Lang) =>
  StyleSheet.create({
    wrap: { gap: 8, marginBottom: 12 },
    label: {
      fontSize: localizedFontSize(12, lang),
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
      height: 64,
      justifyContent: "center",
      cursor: "pointer",
    },
    chipText: {
      color: colors.textDark,
      fontSize: localizedFontSize(14, lang),
      lineHeight: localizedFontSize(28, lang),
    },
  });
