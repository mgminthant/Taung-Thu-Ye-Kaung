/**
 * Header — top bar with the history button (menu icon) and the new-chat
 * button (plus icon). The middle is intentionally empty (ChatGPT-style
 * minimal chrome).
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { useSettings } from "../settings";
import type { ThemeColors } from "../theme";

type Props = {
  onOpenDrawer: () => void;
  onNewChat: () => void;
  /** Disable new chat while an empty chat is already open. */
  newChatDisabled: boolean;
};

export default function Header({
  onOpenDrawer,
  onNewChat,
  newChatDisabled,
}: Props) {
  const { colors, t } = useSettings();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.header}>
      <Pressable
        style={styles.iconBtn}
        onPress={onOpenDrawer}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={t.header.openHistory}
      >
        <Ionicons name="menu" size={24} color={colors.textDark} />
      </Pressable>
      <View style={styles.spacer} />
      <Pressable
        style={[styles.iconBtn, newChatDisabled && styles.iconDisabled]}
        onPress={onNewChat}
        hitSlop={10}
        disabled={newChatDisabled}
        accessibilityRole="button"
        accessibilityLabel={t.header.newChat}
      >
        <Ionicons
          name="add"
          size={26}
          color={newChatDisabled ? colors.mutedLight : colors.textDark}
        />
      </Pressable>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 8,
      paddingTop: 8,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
      backgroundColor: colors.bg,
    },
    spacer: { flex: 1 },
    iconBtn: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
    },
    iconDisabled: { opacity: 0.35 },
  });
