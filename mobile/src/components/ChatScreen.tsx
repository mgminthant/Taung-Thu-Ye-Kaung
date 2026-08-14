/**
 * ChatScreen — the main chat area: message list, suggestions when empty,
 * the typing indicator while loading, and the composer at the bottom.
 *
 * The input text lives here. App remounts this component (via `key`) when
 * the active conversation changes, which resets the input and scroll.
 */
import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";

import type { UiMessage } from "../api/types";
import Composer from "./Composer";
import MessageBubble from "./MessageBubble";
import Suggestions from "./Suggestions";
import TypingIndicator from "./TypingIndicator";

type Props = {
  messages: UiMessage[];
  loading: boolean;
  onSend: (text: string) => void;
  onFeedback: (msg: UiMessage, useful: boolean) => void;
};

export default function ChatScreen({
  messages,
  loading,
  onSend,
  onFeedback,
}: Props) {
  const [input, setInput] = useState("");
  const listRef = useRef<FlatList<UiMessage>>(null);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Scroll to the bottom when content grows, animating once and then
  // snapping to the end so the newest message is always visible.
  const scrollToBottom = () => {
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    if (settleTimeout.current) clearTimeout(settleTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 120);
    settleTimeout.current = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: false });
    }, 500);
  };

  // Clean up pending timers on unmount.
  useEffect(() => {
    return () => {
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
      if (settleTimeout.current) clearTimeout(settleTimeout.current);
    };
  }, []);

  const send = () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    onSend(text);
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={8}
    >
      <FlatList
        ref={listRef}
        style={styles.flex}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onContentSizeChange={scrollToBottom}
        ListFooterComponent={loading ? <TypingIndicator /> : null}
        ListHeaderComponent={
          messages.length <= 1 ? (
            <Suggestions onSelect={onSend} disabled={loading} />
          ) : null
        }
        renderItem={({ item }) => (
          <MessageBubble message={item} onFeedback={onFeedback} />
        )}
      />
      <Composer
        value={input}
        onChangeText={setInput}
        onSend={send}
        loading={loading}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: 16, paddingBottom: 90, gap: 10 },
});
