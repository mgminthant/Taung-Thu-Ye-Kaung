/**
 * MessageBubble — a single chat message.
 * Assistant bubbles show metadata (crop/topic tags, source ids) and
 * a 👍 / 👎 feedback row; user bubbles are a plain green bubble.
 */
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { UiMessage } from "../api/types";
import { useSettings } from "../settings";
import type { ThemeColors } from "../theme";

type Props = {
  message: UiMessage;
  onFeedback: (msg: UiMessage, useful: boolean) => void;
};

export default function MessageBubble({ message, onFeedback }: Props) {
  const { colors, t } = useSettings();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const isUser = message.role === "user";
  const tags = [message.crop, message.topic || message.intent]
    .filter(Boolean)
    .join(" · ");

  const showFeedback =
    !isUser && message.id !== "welcome" && !message.outOfScope;

  return (
    <View style={[styles.bubble, isUser ? styles.userBubble : styles.botBubble]}>
      {!isUser && tags ? <Text style={styles.tags}>{tags}</Text> : null}

      <Text style={[styles.text, isUser && styles.userText]}>
        {message.content}
      </Text>

      {!isUser && message.sources && message.sources.length > 0 ? (
        <Text style={styles.source}>
          {t.message.source}: {message.sources.map((s) => s.id).join(", ")}
          {message.usedLlm ? ` · ${t.message.llm}` : ` · ${t.message.retrieval}`}
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
            >
              👎 {t.message.notUseful}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
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
    tags: {
      fontSize: 11,
      color: colors.muted,
      marginBottom: 6,
      textTransform: "capitalize",
    },
    text: {
      fontSize: 15,
      lineHeight: 30,
      color: colors.textBody,
      textAlignVertical: "top",
    },
    userText: { color: "#fff" },
    source: { marginTop: 8, fontSize: 11, color: colors.muted },
    feedbackRow: { flexDirection: "row", gap: 12, marginTop: 10 },
    feedbackBtn: { paddingVertical: 2 },
    feedbackText: { fontSize: 12, color: colors.muted },
    feedbackActive: { color: colors.primary, fontWeight: "700" },
  });
