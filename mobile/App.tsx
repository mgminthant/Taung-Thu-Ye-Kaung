/**
 * App — composition root.
 *
 * Wraps everything in SafeAreaProvider (needed by useSafeAreaInsets and
 * the safe-area SafeAreaView), loads the chat state via the useChat hook,
 * and renders the four main UI blocks:
 *   Header        → history button + new chat button
 *   ChatScreen    → message list + composer
 *   HistoryDrawer → past-chats panel + rename/delete menus
 *
 * ChatScreen is keyed by the active conversation so switching chats
 * remounts it (resetting the input and scroll position).
 */
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import {
  SafeAreaProvider,
  SafeAreaView,
} from "react-native-safe-area-context";

import ChatScreen from "./src/components/ChatScreen";
import Header from "./src/components/Header";
import HistoryDrawer from "./src/components/HistoryDrawer";
import { useChat } from "./src/hooks/useChat";
import { colors } from "./src/theme";

export default function App() {
  return (
    <SafeAreaProvider>
      <AppShell />
    </SafeAreaProvider>
  );
}

function AppShell() {
  const chat = useChat();

  // Show a spinner while conversations load from local storage.
  if (!chat.hydrated) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />

      <Header
        onOpenDrawer={chat.openDrawer}
        onNewChat={chat.newChat}
        newChatDisabled={chat.isFreshActive}
      />

      <ChatScreen
        key={chat.activeId ?? "none"}
        messages={chat.messages}
        loading={chat.loading}
        onSend={chat.sendMessage}
        onFeedback={chat.toggleFeedback}
      />

      <HistoryDrawer
        open={chat.drawerOpen}
        progress={chat.drawerProgress}
        conversations={chat.historyConversations}
        activeId={chat.activeId}
        isFreshActive={chat.isFreshActive}
        onOpenConversation={chat.openConversation}
        onNewChat={chat.newChat}
        onDeleteConversation={chat.deleteConversation}
        onRenameConversation={chat.renameConversation}
        onClose={chat.closeDrawer}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
