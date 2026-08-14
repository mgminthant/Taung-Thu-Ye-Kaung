/**
 * Header — top bar with the history button (☰) and the new-chat button (✚).
 * The middle is intentionally empty (ChatGPT-style minimal chrome).
 */
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../theme";

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
  return (
    <View style={styles.header}>
      <Pressable
        style={styles.iconBtn}
        onPress={onOpenDrawer}
        hitSlop={10}
        accessibilityLabel="Open chat history"
      >
        <Text style={styles.iconText}>☰</Text>
      </Pressable>
      <View style={styles.spacer} />
      <Pressable
        style={[styles.iconBtn, newChatDisabled && styles.iconDisabled]}
        onPress={onNewChat}
        hitSlop={10}
        disabled={newChatDisabled}
        accessibilityLabel="New chat"
      >
        <Text style={styles.iconText}>✚</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
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
  },
  iconText: { fontSize: 22, color: colors.textDark },
  iconDisabled: { opacity: 0.35 },
});
