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
          <Text style={styles.chipText}>{q}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const createStyles = (colors: ThemeColors, lang: Lang) =>
  StyleSheet.create({
    wrap: {
      gap: 8,
      marginTop: 10,
      marginBottom: 4,
      paddingTop: 8,
      paddingBottom: 2,
      paddingHorizontal: 4,
      alignItems: "stretch",
      flexShrink: 0,
    },
    label: {
      fontSize: localizedFontSize(12, lang),
      fontWeight: "700",
      color: colors.muted,
      textTransform: "uppercase",
      textAlign: "left",
      flexShrink: 0,
    },
    chip: {
      backgroundColor: colors.white,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      justifyContent: "center",
      alignItems: "stretch",
      overflow: "visible",
      flexShrink: 0,
      cursor: "pointer",
    },
    chipText: {
      color: colors.textDark,
      fontSize: localizedFontSize(14, lang),
      // Generous line height (≈2×) so tall Myanmar glyphs aren't clipped at
      // the top/bottom of each line (the previous tight value cut ~1/3).
      lineHeight: localizedFontSize(28, lang),
      textAlign: "left",
      // Let the Text stretch to the chip width via the flex parent instead of
      // an explicit width — an explicit width can mis-measure and clip wrapped
      // text under the New Architecture.
      wordBreak: "break-word",
      overflowWrap: "anywhere",
    },
  });
