/**
 * ChatScreen — the main chat area: message list, suggestions when empty,
 * the typing indicator while loading, and the composer at the bottom.
 *
 * The input text lives here. App remounts this component (via `key`) when
 * the active conversation changes, which resets the input and scroll.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
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
  onFeedback: (
    msg: UiMessage,
    useful: boolean,
    reason?: string,
    comment?: string,
  ) => void;
  onFeedbackClear: (msg: UiMessage) => void;
};

export default function ChatScreen({
  messages,
  loading,
  onSend,
  onFeedback,
  onFeedbackClear,
}: Props) {
  const [input, setInput] = useState("");
  const listRef = useRef<FlatList<UiMessage>>(null);
  const lastCount = useRef(messages.length);
  const contentHeightRef = useRef(0);

  // Keep pinned to the bottom while a response streams and when a new message
  // arrives. We scroll from `onContentSizeChange`, which hands us the *fresh*
  // measured content height `h`; passing that straight to `scrollToOffset`
  // (instead of `scrollToEnd`, which re-reads the native content size that can
  // lag a frame) guarantees we always land at the true bottom — so the growing
  // bubble stays above the composer instead of slipping underneath it.
  const onContentSizeChange = (w: number, h: number) => {
    contentHeightRef.current = h;
    if (messages.length > lastCount.current) {
      lastCount.current = messages.length;
      listRef.current?.scrollToOffset({ offset: h, animated: false });
    } else if (loading) {
      listRef.current?.scrollToOffset({ offset: h, animated: false });
    }
  };

  // Final settle: when streaming finishes, scroll smoothly to the very bottom.
  useEffect(() => {
    if (!loading) {
      listRef.current?.scrollToOffset({
        offset: contentHeightRef.current,
        animated: true,
      });
    }
  }, [loading]);

  // Show the typing indicator only while we wait for the FIRST token. Once the
  // streamed bubble exists (streaming: true) the live text itself is the
  // indicator, so we hide the footer spinner and stop reserving its space.
  const awaitingFirstToken =
    loading && !messages.some((m) => m.streaming);

  // A fresh chat shows the greeting + suggestion chips with tighter spacing.
  const isNewChat = messages.length <= 1;

  const send = () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    onSend(text);
  };

  // Stable renderItem: a new function each render would make FlatList treat
  // every row as changed. With a stable callback + memoized MessageBubble, only
  // the streaming row re-renders per token (keeps the list update cheap).
  const renderItem = useCallback(
    ({ item }: { item: UiMessage }) => (
      <MessageBubble
        message={item}
        onFeedback={onFeedback}
        onFeedbackClear={onFeedbackClear}
      />
    ),
    [onFeedback, onFeedbackClear],
  );

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
        contentContainerStyle={[styles.list, isNewChat && styles.listNewChat]}
        onContentSizeChange={onContentSizeChange}
        windowSize={10}
        initialNumToRender={12}
        ListFooterComponent={
          <>
            {/* On a fresh chat the greeting (welcome) message is the only item,
                so the footer renders right below it: greeting first, then the
                suggestion chips. Shown in both English and Myanmar. Hidden as
                soon as a real message appears. */}
            {isNewChat ? (
              <Suggestions onSelect={onSend} disabled={loading} />
            ) : null}
            {awaitingFirstToken ? <TypingIndicator /> : null}
          </>
        }
        renderItem={renderItem}
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
  list: { padding: 16, paddingBottom: 16, gap: 10 },
  // Fresh chat: less top breathing room around the greeting + chips.
  listNewChat: { paddingTop: 8, paddingBottom: 16 },
});
