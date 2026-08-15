/**
 * MessageBubble — a single chat message.
 * Assistant bubbles show metadata (crop/topic tags, source ids) and
 * a 👍 / 👎 feedback row; user bubbles are a plain green bubble.
 */
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { UiMessage } from "../api/types";
import type { Lang } from "../i18n";
import { useSettings } from "../settings";
import { localizedFontSize, type ThemeColors } from "../theme";

type Props = {
  message: UiMessage;
  onFeedback: (msg: UiMessage, useful: boolean) => void;
};

export default function MessageBubble({ message, onFeedback }: Props) {
  const { colors, t, lang } = useSettings();
  const styles = useMemo(() => createStyles(colors, lang), [colors, lang]);

  const isUser = message.role === "user";
  const isWelcome = message.id === "welcome";
  const tags = [message.crop, message.topic || message.intent]
    .filter(Boolean)
    .join(" · ");

  const showFeedback =
    !isUser && message.id !== "welcome" && !message.outOfScope;

  return (
    <View
      style={[
        styles.bubble,
        isUser ? styles.userBubble : styles.botBubble,
        isWelcome && styles.welcomeBubble,
      ]}
    >
      {!isUser && tags ? <Text style={styles.tags}>{tags}</Text> : null}

      <Text
        style={[
          styles.text,
          isUser && styles.userText,
          isWelcome && styles.welcomeText,
        ]}
        numberOfLines={isWelcome ? 12 : undefined}
      >
        {message.content}
      </Text>

      {!isUser && message.sources && message.sources.length > 0 ? (
        <Text style={styles.source} numberOfLines={1}>
          {t.message.source}: {message.sources.map((s) => s.id).join(", ")}
          {message.usedLlm
            ? ` · ${t.message.llm}`
            : ` · ${t.message.retrieval}`}
        </Text>
      ) : null}

      {showFeedback ? (
        <View style={styles.feedbackRow}>
          <Pressable
            onPress={() => onFeedback(message, true)}
            style={styles.feedbackBtn}
          >
            <Text
              style={[
                styles.feedbackText,
                message.feedback === "up" && styles.feedbackActive,
              ]}
              numberOfLines={1}
            >
              👍 {t.message.useful}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onFeedback(message, false)}
            style={styles.feedbackBtn}
          >
            <Text
              style={[
                styles.feedbackText,
                message.feedback === "down" && styles.feedbackActive,
              ]}
              numberOfLines={1}
            >
              👎 {t.message.notUseful}
            </Text>
          </Pressable>
        </View>
      ) : null}
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
    userBubble: {
      alignSelf: "flex-end",
      backgroundColor: colors.primary,
    },
    botBubble: {
      alignSelf: "flex-start",
      backgroundColor: colors.white,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    welcomeBubble: {
      height: 300,
      justifyContent: "center",
      overflow: "hidden",
    },
    welcomeText: {
      textAlign: "left",
      lineHeight: localizedFontSize(28, lang),
    },
    tags: {
      fontSize: localizedFontSize(11, lang),
      color: colors.muted,
      marginBottom: 6,
      textTransform: "capitalize",
    },
    text: {
      fontSize: localizedFontSize(15, lang),
      lineHeight: localizedFontSize(30, lang),
      color: colors.textBody,
      textAlignVertical: "top",
    },
    userText: { color: "#fff" },
    source: {
      marginTop: 8,
      fontSize: localizedFontSize(11, lang),
      color: colors.muted,
    },
    feedbackRow: { flexDirection: "row", gap: 12, marginTop: 10 },
    feedbackBtn: { paddingVertical: 2, flexShrink: 1 },
    feedbackText: {
      fontSize: localizedFontSize(12, lang),
      color: colors.muted,
    },
    feedbackActive: { color: colors.primary, fontWeight: "700" },
  });
