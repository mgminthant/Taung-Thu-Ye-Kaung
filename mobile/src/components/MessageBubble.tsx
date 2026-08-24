/**
 * MessageBubble — a single chat message.
 * Assistant bubbles offer a copy action plus 👍 / 👎 feedback; user
 * bubbles are a plain green bubble.
 */
import { memo, useMemo, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import * as Clipboard from "expo-clipboard";

import type { UiMessage } from "../api/types";
import type { Lang } from "../i18n";
import { useSettings } from "../settings";
import { localizedFontSize, type ThemeColors } from "../theme";

type Props = {
  message: UiMessage;
  onFeedback: (
    msg: UiMessage,
    useful: boolean,
    reason?: string,
    comment?: string,
  ) => void;
  /** Toggle-off: clears a previously selected thumb locally. */
  onFeedbackClear: (msg: UiMessage) => void;
};

function MessageBubble({ message, onFeedback, onFeedbackClear }: Props) {
  const { colors, t, lang } = useSettings();
  const styles = useMemo(() => createStyles(colors, lang), [colors, lang]);

  // prd.md §16: tapping 👎 asks why before submitting.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [reasonIdx, setReasonIdx] = useState<number | null>(null);
  const [comment, setComment] = useState("");

  // Tiny transient toast (feedback thanks). Copy confirms via icon swap only.
  const [toast, setToast] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1600);
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(message.content);
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1600);
  };

  const openSheet = () => {
    setReasonIdx(null);
    setComment("");
    setSheetOpen(true);
  };

  // Tap an active thumb again to deselect (no re-submit).
  const handleUseful = () => {
    if (message.feedback === "up") onFeedbackClear(message);
    else onFeedback(message, true);
  };

  const handleNotUseful = () => {
    if (message.feedback === "down") onFeedbackClear(message);
    else openSheet();
  };

  const submitNegative = () => {
    if (reasonIdx === null) return;
    onFeedback(
      message,
      false,
      t.message.feedbackReasons[reasonIdx],
      comment.trim() || undefined,
    );
    setSheetOpen(false);
    showToast(t.message.feedbackThanks);
  };

  const isUser = message.role === "user";
  const isWelcome = message.id === "welcome";

  const showFeedback =
    !isUser &&
    !message.streaming &&
    message.id !== "welcome" &&
    // No thumbs on canned replies: non-farming refusals, greetings,
    // follow-up questions, and honest "haven't learned that yet" answers.
    !message.outOfScope &&
    !message.needsClarification &&
    !message.insufficientKnowledge &&
    message.intent !== "greeting";

  // Copy action on every finished bot bubble; thumbs only where meaningful.
  const showActions = !isUser && !message.streaming && !isWelcome;

  return (
    <>
      <View
        style={[
          styles.bubble,
          isUser ? styles.userBubble : styles.botBubble,
          isWelcome && styles.welcomeBubble,
        ]}
      >
      <Text
        style={[
          styles.text,
          isUser && styles.userText,
          isWelcome && styles.welcomeText,
        ]}
        numberOfLines={isWelcome ? 0 : undefined}
      >
        {message.content}
      </Text>

      {showActions ? (
        <View style={styles.feedbackRow}>
          {showFeedback ? (
            <>
              <Pressable
                onPress={handleUseful}
                style={styles.feedbackBtn}
                hitSlop={6}
                accessibilityLabel={t.message.useful}
              >
                <FontAwesome
                  name={
                    message.feedback === "up" ? "thumbs-up" : "thumbs-o-up"
                  }
                  size={15}
                  color={
                    message.feedback === "up" ? colors.primary : colors.muted
                  }
                />
                <Text
                  style={[
                    styles.feedbackLabel,
                    message.feedback === "up" && styles.feedbackLabelActiveUp,
                  ]}
                  numberOfLines={1}
                >
                  {t.message.useful}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleNotUseful}
                style={styles.feedbackBtn}
                hitSlop={6}
                accessibilityLabel={t.message.notUseful}
              >
                <FontAwesome
                  name={
                    message.feedback === "down"
                      ? "thumbs-down"
                      : "thumbs-o-down"
                  }
                  size={15}
                  color={
                    message.feedback === "down" ? colors.danger : colors.muted
                  }
                />
                <Text
                  style={[
                    styles.feedbackLabel,
                    message.feedback === "down" &&
                      styles.feedbackLabelActiveDown,
                  ]}
                  numberOfLines={1}
                >
                  {t.message.notUseful}
                </Text>
              </Pressable>
            </>
          ) : null}
          <Pressable
            onPress={handleCopy}
            style={styles.copyBtn}
            hitSlop={6}
            accessibilityLabel={t.message.copy}
          >
            <Ionicons
              name={copied ? "checkmark" : "copy-outline"}
              size={14}
              color={copied ? colors.primary : colors.muted}
            />
            <Text style={[styles.feedbackLabel, copied && { color: colors.primary }]}>
              {copied ? t.message.copied : t.message.copy}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {toast ? (
        <View style={styles.toastPill} pointerEvents="none">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
      </View>

      {/* prd.md §16 reason/comment sheet (shown on 👎). */}
      <Modal
        transparent
        visible={sheetOpen}
        animationType="fade"
        onRequestClose={() => setSheetOpen(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setSheetOpen(false)}>
          <Pressable style={styles.sheetCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>{t.message.feedbackTitle}</Text>
            {t.message.feedbackReasons.map((r, i) => (
              <Pressable
                key={r}
                style={[styles.reasonRow, reasonIdx === i && styles.reasonRowActive]}
                onPress={() => setReasonIdx(i)}
              >
                <View style={[styles.radio, reasonIdx === i && styles.radioActive]} />
                <Text
                  style={[
                    styles.reasonText,
                    reasonIdx === i && styles.reasonTextActive,
                  ]}
                >
                  {r}
                </Text>
              </Pressable>
            ))}
            <TextInput
              style={styles.commentInput}
              value={comment}
              onChangeText={setComment}
              placeholder={t.message.feedbackCommentPlaceholder}
              placeholderTextColor={colors.mutedLight}
              multiline
            />
            <View style={styles.sheetActions}>
              <Pressable style={styles.sheetCancel} onPress={() => setSheetOpen(false)}>
                <Text style={styles.sheetCancelText}>{t.message.feedbackCancel}</Text>
              </Pressable>
              <Pressable
                style={[styles.sheetSubmit, reasonIdx === null && styles.sheetSubmitDisabled]}
                disabled={reasonIdx === null}
                onPress={submitNegative}
              >
                <Text style={styles.sheetSubmitText}>{t.message.feedbackSubmit}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export default memo(MessageBubble);

const createStyles = (colors: ThemeColors, lang: Lang) =>
  StyleSheet.create({
    bubble: {
      maxWidth: "92%",
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
      flexShrink: 0,
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
      justifyContent: "flex-start",
      paddingVertical: 10,
    },
    welcomeText: {
      textAlign: "left",
      lineHeight: localizedFontSize(32, lang),
    },
    text: {
      fontSize: localizedFontSize(15, lang),
      lineHeight: localizedFontSize(30, lang),
      color: colors.textBody,
      textAlignVertical: "top",
    },
    userText: { color: "#fff" },
    feedbackRow: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 10 },
    copyBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      cursor: "pointer",
    },
    feedbackBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      cursor: "pointer",
    },
    feedbackLabel: {
      fontSize: localizedFontSize(12, lang),
      color: colors.muted,
    },
    feedbackLabelActiveUp: { color: colors.primary, fontWeight: "700" },
    feedbackLabelActiveDown: { color: colors.danger, fontWeight: "700" },
    toastPill: {
      position: "absolute",
      bottom: -30,
      alignSelf: "center",
      // Fixed dark green — visible in both light and dark themes.
      backgroundColor: "#1f3d2a",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
    },
    toastText: {
      color: "#fff",
      fontSize: localizedFontSize(11, lang),
    },
    sheetBackdrop: {
      flex: 1,
      backgroundColor: colors.modalBackdrop,
      justifyContent: "flex-end",
    },
    sheetCard: {
      backgroundColor: colors.white,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 20,
      gap: 10,
    },
    sheetTitle: {
      fontSize: localizedFontSize(16, lang),
      fontWeight: "700",
      color: colors.textDark,
      marginBottom: 4,
    },
    reasonRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.borderLight,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    reasonRowActive: { borderColor: colors.primary, backgroundColor: colors.activeBg },
    radio: {
      width: 16,
      height: 16,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: colors.border,
    },
    radioActive: { borderColor: colors.primary, backgroundColor: colors.primary },
    reasonText: {
      fontSize: localizedFontSize(14, lang),
      color: colors.textBody,
      flexShrink: 1,
    },
    reasonTextActive: { color: colors.primary, fontWeight: "600" },
    commentInput: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 8,
      minHeight: 56,
      textAlignVertical: "top",
      fontSize: localizedFontSize(14, lang),
      color: colors.textBody,
    },
    sheetActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 12,
      marginTop: 4,
    },
    sheetCancel: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 },
    sheetCancelText: {
      fontSize: localizedFontSize(14, lang),
      color: colors.muted,
      fontWeight: "600",
    },
    sheetSubmit: {
      backgroundColor: colors.primary,
      paddingVertical: 8,
      paddingHorizontal: 18,
      borderRadius: 10,
    },
    sheetSubmitDisabled: { opacity: 0.4 },
    sheetSubmitText: {
      fontSize: localizedFontSize(14, lang),
      color: "#fff",
      fontWeight: "700",
    },
  });
