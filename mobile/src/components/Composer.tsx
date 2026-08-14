/**
 * Composer — the text input + Send button at the bottom of the chat.
 * The input value is controlled by the parent (ChatScreen) so the parent
 * can clear it after sending and reset it when switching conversations.
 */
import { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useSettings } from "../settings";
import type { ThemeColors } from "../theme";

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  loading: boolean;
};

export default function Composer({
  value,
  onChangeText,
  onSend,
  loading,
}: Props) {
  const { colors, t } = useSettings();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Disable send when there is no text, or while the backend is replying.
  const disabled = !value.trim() || loading;

  return (
    <View style={styles.composer}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={t.composer.placeholder}
        placeholderTextColor={colors.mutedLight}
        editable={!loading}
        multiline
        onSubmitEditing={onSend}
      />
      <Pressable
        style={[styles.send, disabled && styles.sendDisabled]}
        onPress={onSend}
        disabled={disabled}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.sendText}>{t.composer.send}</Text>
        )}
      </Pressable>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    composer: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 12,
      paddingTop: 8,
      alignItems: "flex-end",
    },
    input: {
      flex: 1,
      minHeight: 44,
      maxHeight: 120,
      backgroundColor: colors.white,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      lineHeight: 24,
      color: colors.textDark,
      textAlignVertical: "center",
    },
    send: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingHorizontal: 16,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    sendDisabled: { opacity: 0.5 },
    sendText: { color: "#fff", fontWeight: "700" },
  });
