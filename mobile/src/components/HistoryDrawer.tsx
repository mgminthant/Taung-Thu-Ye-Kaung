/**
 * HistoryDrawer — the slide-in panel listing past conversations.
 *
 * Responsibilities:
 *  - animates in/out based on the `progress` Animated.Value from useChat
 *  - lists conversations (newest first), each with a ⋮ actions button
 *  - the ⋮ opens a small menu (Rename / Delete) positioned next to the row
 *    via measureInWindow, rendered in its own Modal so it can never be clipped
 *    or overlap the drawer header
 *  - a Rename modal with a text input
 */
import { useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Conversation } from "../api/types";
import { colors } from "../theme";

type Props = {
  /** Whether the drawer is currently rendered (true during open+close). */
  open: boolean;
  /** Animated value from useChat: 0 closed, 1 fully open. */
  progress: Animated.Value;
  /** Conversations to show (fresh chats are already filtered out). */
  conversations: Conversation[];
  activeId: string | null;
  /** Disables "New chat" while an empty chat is open. */
  isFreshActive: boolean;
  onOpenConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, title: string) => void;
  onClose: () => void;
};

// Fixed size of the ⋮ menu so we can position it on screen.
const MENU_WIDTH = 168;
const MENU_HEIGHT = 96;

type MenuPos = { id: string; x: number; y: number };

export default function HistoryDrawer({
  open,
  progress,
  conversations,
  activeId,
  isFreshActive,
  onOpenConversation,
  onNewChat,
  onDeleteConversation,
  onRenameConversation,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();

  // The ⋮ menu: holds which row it is open for and its screen coordinates.
  const [menuFor, setMenuFor] = useState<MenuPos | null>(null);
  const [renameFor, setRenameFor] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  // Refs to each row so we can measure where to place the ⋮ menu.
  const rowRefs = useRef<Record<string, View | null>>({});

  // Slide the panel in from the left and fade the backdrop in.
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-340, 0],
  });
  const backdropOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const menuItem = menuFor
    ? conversations.find((c) => c.id === menuFor.id) ?? null
    : null;

  // ---- ⋮ menu -----------------------------------------------------------

  const toggleMenu = (id: string) => {
    if (menuFor?.id === id) {
      setMenuFor(null);
      return;
    }
    const el = rowRefs.current[id];
    const { width: winW, height: winH } = Dimensions.get("window");
    if (!el) {
      setMenuFor({ id, x: Math.max(8, winW - MENU_WIDTH - 8), y: 90 });
      return;
    }
    // Measure the row in window coordinates, then place the menu to the
    // right edge of the row, flipping upward when near the bottom edge.
    el.measureInWindow((mx, my, mw) => {
      let x = mx + mw - MENU_WIDTH - 8;
      x = Math.max(8, Math.min(x, winW - MENU_WIDTH - 8));
      let y = my + 48;
      if (y + MENU_HEIGHT > winH) y = my - MENU_HEIGHT - 8;
      y = Math.max(8, y);
      setMenuFor({ id, x, y });
    });
  };

  const startRename = (item: Conversation) => {
    setMenuFor(null);
    setRenameValue(item.title);
    setRenameFor(item.id);
  };

  const cancelRename = () => {
    setRenameFor(null);
    setRenameValue("");
  };

  const saveRename = () => {
    if (!renameFor) return;
    onRenameConversation(renameFor, renameValue.trim() || "New chat");
    cancelRename();
  };

  if (!open) return null;

  return (
    <View style={styles.overlay}>
      {/* Dimmed area behind the drawer; tapping it closes the drawer. */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={styles.flex} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[styles.drawer, { transform: [{ translateX }] }]}
      >
        {/* Drawer header (pushed below the status bar via safe-area inset). */}
        <View style={[styles.drawerHeader, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.drawerTitle}>Chats</Text>
          <Pressable
            style={[styles.newChatBtn, isFreshActive && styles.newChatDisabled]}
            onPress={onNewChat}
            disabled={isFreshActive}
            accessibilityLabel="Start new chat"
          >
            <Text style={styles.newChatText}>＋ New chat</Text>
          </Pressable>
        </View>

        <FlatList
          style={styles.drawerList}
          data={[...conversations].reverse()}
          keyExtractor={(item) => item.id}
          onScroll={() => setMenuFor(null)}
          scrollEventThrottle={16}
          renderItem={({ item }) => {
            const isActive = item.id === activeId;
            const preview =
              [...item.messages].reverse().find((m) => m.id !== "welcome")
                ?.content ?? "No messages yet";
            return (
              <View
                style={styles.drawerRow}
                ref={(el) => {
                  rowRefs.current[item.id] = el;
                }}
              >
                <Pressable
                  style={[styles.drawerItem, isActive && styles.drawerItemActive]}
                  onPress={() => onOpenConversation(item.id)}
                >
                  <Text
                    style={[
                      styles.drawerTitle,
                      isActive && styles.drawerTitleActive,
                    ]}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  <Text style={styles.drawerPreview} numberOfLines={1}>
                    {preview}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.moreBtn}
                  onPress={() => toggleMenu(item.id)}
                  hitSlop={6}
                  accessibilityLabel={`Actions for ${item.title}`}
                >
                  <Text style={styles.moreText}>⋮</Text>
                </Pressable>
              </View>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.drawerEmpty}>No chats yet</Text>
          }
        />
      </Animated.View>

      {/* Rename modal */}
      <Modal
        visible={renameFor !== null}
        transparent
        animationType="fade"
        onRequestClose={cancelRename}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable style={styles.modalScrim} onPress={cancelRename} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Rename chat</Text>
            <TextInput
              style={styles.modalInput}
              value={renameValue}
              onChangeText={setRenameValue}
              autoFocus
              placeholder="Chat name"
              placeholderTextColor={colors.mutedLight}
              onSubmitEditing={saveRename}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalBtn} onPress={cancelRename}>
                <Text style={styles.modalBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnPrimary]}
                onPress={saveRename}
              >
                <Text style={[styles.modalBtnText, styles.modalBtnPrimaryText]}>
                  Save
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ⋮ actions menu — in a Modal so it floats above the drawer,
          and taps outside close it via the transparent scrim. */}
      <Modal
        visible={menuFor !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuFor(null)}
      >
        <Pressable style={styles.menuScrim} onPress={() => setMenuFor(null)} />
        {menuFor && menuItem ? (
          <View style={[styles.menu, { left: menuFor.x, top: menuFor.y }]}>
            <Pressable
              style={styles.menuItem}
              onPress={() => startRename(menuItem)}
            >
              <Text style={styles.menuItemText}>✎ Rename</Text>
            </Pressable>
            <Pressable
              style={[styles.menuItem, styles.menuItemDanger]}
              onPress={() => onDeleteConversation(menuItem.id)}
            >
              <Text style={[styles.menuItemText, styles.menuDangerText]}>
                Delete
              </Text>
            </Pressable>
          </View>
        ) : null}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.backdrop,
  },
  drawer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: "82%",
    maxWidth: 340,
    backgroundColor: colors.drawerBg,
    borderRightWidth: 1,
    borderRightColor: colors.borderLight,
  },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  drawerTitle: { fontSize: 15, fontWeight: "700", color: colors.textDark },
  newChatBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  newChatText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  newChatDisabled: { opacity: 0.4 },
  drawerList: { flex: 1 },
  drawerRow: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },
  drawerItem: {
    flex: 1,
    paddingHorizontal: 16,
    paddingRight: 48,
    paddingVertical: 12,
    gap: 2,
  },
  drawerItemActive: { backgroundColor: colors.activeBg },
  drawerTitleActive: { color: colors.primary },
  drawerPreview: { fontSize: 12, color: colors.muted },
  moreBtn: {
    position: "absolute",
    right: 4,
    top: 0,
    bottom: 0,
    width: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  moreText: { fontSize: 22, color: colors.muted, fontWeight: "700" },
  drawerEmpty: { padding: 16, color: colors.muted },
  menuScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
  },
  menu: {
    position: "absolute",
    width: MENU_WIDTH,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingVertical: 4,
    shadowColor: colors.textDark,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  menuItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  menuItemText: { fontSize: 14, color: colors.textDark },
  menuItemDanger: {
    borderTopWidth: 1,
    borderTopColor: "#eef2ec",
  },
  menuDangerText: { color: colors.danger },
  modalBackdrop: { flex: 1, alignItems: "center", justifyContent: "center" },
  modalScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.modalBackdrop,
  },
  modalCard: {
    width: "82%",
    maxWidth: 340,
    backgroundColor: colors.drawerBg,
    borderRadius: 16,
    padding: 18,
    gap: 12,
  },
  modalTitle: { fontSize: 17, fontWeight: "700", color: colors.textDark },
  modalInput: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.textDark,
  },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  modalBtn: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  modalBtnText: { fontSize: 14, color: colors.muted, fontWeight: "600" },
  modalBtnPrimary: { backgroundColor: colors.primary },
  modalBtnPrimaryText: { color: "#fff" },
});
