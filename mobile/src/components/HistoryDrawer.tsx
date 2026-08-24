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
 *  - a settings footer: dark/light mode switch + English/Myanmar switcher
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { BlurView } from "expo-blur";
import { useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Conversation } from "../api/types";
import type { Lang } from "../i18n";
import { useAuth } from "../hooks/useAuth";
import { useSettings } from "../settings";
import { glassConfig, localizedFontSize, type ThemeColors } from "../theme";

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
  const { colors, t, isDark, lang, toggleTheme, setLang } = useSettings();
  const { user, logout } = useAuth();
  const styles = useMemo(() => createStyles(colors, lang), [colors, lang]);

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

  // Fresh chats are stored with the English "New chat" sentinel title; render
  // it in the active UI language so the drawer is fully localized.
  const displayTitle = (title: string) =>
    title === "New chat" ? t.drawer.newChat : title;

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
    onRenameConversation(renameFor, renameValue.trim() || t.drawer.newChat);
    cancelRename();
  };

  if (!open) return null;

  return (
    <View style={styles.overlay}>
      {/* Dimmed area behind the drawer; tapping it closes the drawer. */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={styles.flex} onPress={onClose} />
      </Animated.View>

      <Animated.View style={styles.drawer}>
        {/* Static glass background, OUTSIDE the slide transform. iOS
            UIVisualEffectView freezes on its first frame when animated via a
            native-driver transform (blur looks missing until a re-render). */}
        <BlurView
          pointerEvents="none"
          intensity={glassConfig.intensity}
          tint={isDark ? glassConfig.tint.dark : glassConfig.tint.light}
          style={styles.drawerBlur}
        />

        {/* Content slides in/out over the static glass. */}
        <Animated.View
          style={[styles.drawerContent, { transform: [{ translateX }] }]}
        >
          {/* Drawer header (pushed below the status bar via safe-area inset). */}
          <View style={[styles.drawerHeader, { paddingTop: insets.top + 12 }]}>
            <Text
              style={[styles.drawerTitle, styles.drawerHeaderTitle]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {t.drawer.chats}
            </Text>
            <Pressable
              style={[styles.newChatBtn, isFreshActive && styles.newChatDisabled]}
              onPress={onNewChat}
              disabled={isFreshActive}
              accessibilityRole="button"
              accessibilityLabel={t.drawer.startNewChat}
            >
              <Ionicons name="add" size={16} color="#fff" />
              <Text
                style={styles.newChatText}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {t.drawer.newChat}
              </Text>
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
                ?.content ?? t.drawer.noMessagesYet;
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
                    {displayTitle(item.title)}
                  </Text>
                  <Text style={styles.drawerPreview} numberOfLines={1}>
                    {preview}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.moreBtn}
                  onPress={() => toggleMenu(item.id)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`${t.drawer.actionsFor} ${displayTitle(item.title)}`}
                >
                  <Ionicons
                    name="ellipsis-horizontal"
                    size={20}
                    color={colors.muted}
                  />
                </Pressable>
              </View>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.drawerEmpty}>{t.drawer.noChatsYet}</Text>
          }
        />

        {/* Settings footer: user info + theme + language + logout (on the shared glass). */}
        <View
          style={[
            styles.settingsFooter,
            { paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          {/* User info */}
          <View style={styles.settingsRow}>
            <Ionicons
              name={user?.isGuest ? "person-outline" : "person-circle-outline"}
              size={18}
              color={colors.textDark}
            />
            <Text
              style={styles.settingsLabel}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {user?.isGuest ? t.settings.guest : user?.displayName ?? ""}
            </Text>
          </View>

          <View style={styles.settingsRow}>
            <Ionicons
              name={isDark ? "sunny-outline" : "moon-outline"}
              size={18}
              color={colors.textDark}
            />
            <Text
              style={styles.settingsLabel}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {t.settings.darkMode}
            </Text>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.mutedLight, true: colors.primary }}
              thumbColor={isDark ? "#f5f5f5" : "#ffffff"}
            />
          </View>

          <View style={styles.settingsRow}>
            <Ionicons
              name="language-outline"
              size={18}
              color={colors.textDark}
            />
            <Text
              style={styles.settingsLabel}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {t.settings.language}
            </Text>
            <View style={styles.langGroup}>
              <Pressable
                style={[styles.langBtn, lang === "en" && styles.langBtnActive]}
                onPress={() => setLang("en")}
                accessibilityRole="button"
                accessibilityState={{ selected: lang === "en" }}
              >
                <Text
                  style={[
                    styles.langBtnText,
                    lang === "en" && styles.langBtnTextActive,
                  ]}
                >
                  {t.settings.english}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.langBtn, lang === "mm" && styles.langBtnActive]}
                onPress={() => setLang("mm")}
                accessibilityRole="button"
                accessibilityState={{ selected: lang === "mm" }}
              >
                <Text
                  style={[
                    styles.langBtnText,
                    lang === "mm" && styles.langBtnTextActive,
                  ]}
                >
                  {t.settings.myanmar}
                </Text>
              </Pressable>
            </View>
          </View>

          <Pressable style={styles.logoutRow} onPress={logout}>
            <Ionicons name="log-out-outline" size={18} color={colors.danger} />
            <Text style={styles.logoutText}>{t.settings.logout}</Text>
          </Pressable>
        </View>
        </Animated.View>
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
            <Text style={styles.modalTitle}>{t.drawer.renameChat}</Text>
            <TextInput
              style={styles.modalInput}
              value={renameValue}
              onChangeText={setRenameValue}
              autoFocus
              placeholder={t.drawer.chatName}
              placeholderTextColor={colors.mutedLight}
              onSubmitEditing={saveRename}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalBtn} onPress={cancelRename}>
                <Text style={styles.modalBtnText}>{t.drawer.cancel}</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnPrimary]}
                onPress={saveRename}
              >
                <Text style={[styles.modalBtnText, styles.modalBtnPrimaryText]}>
                  {t.drawer.save}
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
              <Ionicons name="create-outline" size={16} color={colors.textDark} />
              <Text style={styles.menuItemText}>{t.drawer.rename}</Text>
            </Pressable>
            <Pressable
              style={[styles.menuItem, styles.menuItemDanger]}
              onPress={() => onDeleteConversation(menuItem.id)}
            >
              <Ionicons name="trash-outline" size={16} color={colors.danger} />
              <Text style={[styles.menuItemText, styles.menuDangerText]}>
                {t.drawer.delete}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </Modal>
    </View>
  );
}

const createStyles = (colors: ThemeColors, lang: Lang) =>
  StyleSheet.create({
    flex: { flex: 1, cursor: "pointer" },
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
      borderRightWidth: 1,
      borderRightColor: colors.borderLight,
      overflow: "hidden",
    },
    drawerContent: { flex: 1 },
    drawerBlur: {
      ...StyleSheet.absoluteFillObject,
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
    drawerTitle: {
      fontSize: localizedFontSize(15, lang),
      fontWeight: "700",
      color: colors.textDark,
    },
    drawerHeaderTitle: { flex: 1, flexShrink: 1, marginRight: 10 },
    newChatBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
      width: 92,
      height: 30,
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingHorizontal: 10,
      cursor: "pointer",
    },
    newChatText: {
      color: "#fff",
      fontSize: localizedFontSize(12, lang),
      fontWeight: "700",
      flexShrink: 1,
    },
    newChatDisabled: { opacity: 0.4 },
    drawerList: { flex: 1 },
    drawerRow: {
      flexDirection: "row",
      alignItems: "center",
      position: "relative",
      height: 64,
    },
    drawerItem: {
      flex: 1,
      paddingHorizontal: 16,
      paddingRight: 48,
      paddingVertical: 8,
      gap: 2,
      cursor: "pointer",
    },
    drawerItemActive: { backgroundColor: colors.activeBg },
    drawerTitleActive: { color: colors.primary },
    drawerPreview: {
      fontSize: localizedFontSize(12, lang),
      color: colors.muted,
    },
    moreBtn: {
      position: "absolute",
      right: 4,
      top: 0,
      bottom: 0,
      width: 36,
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
    },
    drawerEmpty: { padding: 16, color: colors.muted },
    settingsFooter: {
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
      paddingHorizontal: 16,
      paddingTop: 12,
      gap: 12,
    },
    settingsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      minHeight: 32,
    },
    settingsLabel: {
      flex: 1,
      fontSize: localizedFontSize(14, lang),
      color: colors.textDark,
    },
    langGroup: {
      flexDirection: "row",
      backgroundColor: colors.white,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      overflow: "hidden",
    },
    langBtn: {
      width: 64,
      paddingHorizontal: 12,
      paddingVertical: 7,
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
    },
    langBtnActive: { backgroundColor: colors.primary },
    langBtnText: {
      fontSize: localizedFontSize(13, lang),
      color: colors.muted,
      fontWeight: "600",
      textAlign: "center",
    },
    langBtnTextActive: { color: "#fff" },
    logoutRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      minHeight: 32,
      marginTop: 4,
      cursor: "pointer",
    },
    logoutText: {
      flex: 1,
      fontSize: localizedFontSize(14, lang),
      color: colors.danger,
      fontWeight: "600",
    },
    menuScrim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "transparent",
      cursor: "pointer",
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
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      cursor: "pointer",
    },
    menuItemText: {
      fontSize: localizedFontSize(14, lang),
      color: colors.textDark,
    },
    menuItemDanger: {
      borderTopWidth: 1,
      borderTopColor: colors.menuDivider,
    },
    menuDangerText: { color: colors.danger },
    modalBackdrop: { flex: 1, alignItems: "center", justifyContent: "center" },
    modalScrim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.modalBackdrop,
      cursor: "pointer",
    },
    modalCard: {
      width: "82%",
      maxWidth: 340,
      backgroundColor: colors.drawerBg,
      borderRadius: 16,
      padding: 18,
      gap: 12,
    },
    modalTitle: {
      fontSize: localizedFontSize(17, lang),
      fontWeight: "700",
      color: colors.textDark,
    },
    modalInput: {
      backgroundColor: colors.white,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: localizedFontSize(15, lang),
      color: colors.textDark,
    },
    modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
    modalBtn: {
      borderRadius: 10,
      paddingHorizontal: 16,
      paddingVertical: 8,
      cursor: "pointer",
    },
    modalBtnText: {
      fontSize: localizedFontSize(14, lang),
      color: colors.muted,
      fontWeight: "600",
    },
    modalBtnPrimary: { backgroundColor: colors.primary },
    modalBtnPrimaryText: { color: "#fff" },
  });
