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
import { AuthProvider, useAuth } from "./src/hooks/useAuth";
import { SettingsProvider, useSettings } from "./src/settings";
import AuthScreen from "./src/screens/AuthScreen";

export default function App() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}

function AppShell() {
  const { user, hydrated: authHydrated } = useAuth();
  const { colors, isDark, hydrated: settingsHydrated } = useSettings();

  if (!authHydrated || !settingsHydrated) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <AuthScreen />
      </SafeAreaView>
    );
  }

  return <ChatApp />;
}

function ChatApp() {
  const chat = useChat();
  const { colors, isDark } = useSettings();

  if (!chat.hydrated) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <StatusBar style={isDark ? "light" : "dark"} />

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
        onFeedbackClear={chat.clearFeedback}
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
  safe: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
