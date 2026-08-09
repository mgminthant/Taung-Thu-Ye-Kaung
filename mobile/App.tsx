import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { checkHealth, sendChat, sendFeedback } from "./src/api/chat";
import type { ChatHistoryItem, UiMessage } from "./src/api/types";
import { API_BASE_URL, SUGGESTED_QUESTIONS } from "./src/config";

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function App() {
  const [messages, setMessages] = useState<UiMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi — I’m MrFarmer, your farming assistant. Ask about crops, pests, diseases, fertilizer, or watering.\n\nAI advice is not a substitute for a local agriculture officer.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [llmReady, setLlmReady] = useState(false);
  const listRef = useRef<FlatList<UiMessage>>(null);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    return () => {
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
      if (settleTimeout.current) clearTimeout(settleTimeout.current);
    };
  }, []);

  useEffect(() => {
    checkHealth()
      .then((h) => {
        setBackendOk(true);
        setLlmReady(h.openrouter_configured);
      })
      .catch(() => {
        setBackendOk(false);
        setLlmReady(false);
      });
  }, []);

  const historyForApi = (): ChatHistoryItem[] =>
    messages
      .filter((m) => m.id !== "welcome")
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }));

  const ask = async (raw: string) => {
    const text = raw.trim();
    if (!text || loading) return;

    const userMsg: UiMessage = { id: makeId(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const result = await sendChat(text, historyForApi());
      const assistantMsg: UiMessage = {
        id: makeId(),
        role: "assistant",
        content: result.answer,
        crop: result.crop,
        topic: result.topic,
        intent: result.intent,
        sources: result.sources,
        usedLlm: result.used_llm,
        outOfScope: result.out_of_scope,
        feedback: null,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setBackendOk(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not reach the backend.";
      setMessages((prev) => [
        ...prev,
        {
          id: makeId(),
          role: "assistant",
          content: `Backend error: ${message}\n\nStart the API with:\ncd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000\n\nAPI URL: ${API_BASE_URL}`,
        },
      ]);
      setBackendOk(false);
    } finally {
      setLoading(false);
    }
  };

  const onFeedback = async (msg: UiMessage, useful: boolean) => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    try {
      await sendFeedback({
        message: lastUser.content,
        answer: msg.content,
        useful,
        source_ids: (msg.sources ?? []).map((s) => s.id),
      });
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id ? { ...m, feedback: useful ? "up" : "down" } : m,
        ),
      );
    } catch {
      // ignore feedback errors in MVP UI
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
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
          ListFooterComponent={
            loading ? (
              <View style={[styles.bubble, styles.botBubble, styles.typing]}>
                <ActivityIndicator size="small" color="#2f6b45" />
                <Text style={styles.typingText}>Thinking…</Text>
              </View>
            ) : null
          }
          ListHeaderComponent={
            messages.length <= 1 ? (
              <View style={styles.suggestions}>
                <Text style={styles.suggestionsLabel}>Try asking</Text>
                {SUGGESTED_QUESTIONS.map((q) => (
                  <Pressable
                    key={q}
                    style={styles.chip}
                    onPress={() => ask(q)}
                    disabled={loading}
                  >
                    <Text style={styles.chipText}>{q}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const isUser = item.role === "user";
            const tags = [item.crop, item.topic || item.intent]
              .filter(Boolean)
              .join(" · ");
            return (
              <View
                style={[
                  styles.bubble,
                  isUser ? styles.userBubble : styles.botBubble,
                ]}
              >
                {!isUser && tags ? (
                  <Text style={styles.tags}>{tags}</Text>
                ) : null}
                <Text style={[styles.bubbleText, isUser && styles.userText]}>
                  {item.content}
                </Text>
                {!isUser && item.sources && item.sources.length > 0 ? (
                  <Text style={styles.source}>
                    Source: {item.sources.map((s) => s.id).join(", ")}
                    {item.usedLlm ? " · LLM" : " · retrieval"}
                  </Text>
                ) : null}
                {!isUser && item.id !== "welcome" && !item.outOfScope ? (
                  <View style={styles.feedbackRow}>
                    <Pressable
                      onPress={() => onFeedback(item, true)}
                      style={styles.feedbackBtn}
                    >
                      <Text
                        style={[
                          styles.feedbackText,
                          item.feedback === "up" && styles.feedbackActive,
                        ]}
                      >
                        👍 Useful
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => onFeedback(item, false)}
                      style={styles.feedbackBtn}
                    >
                      <Text
                        style={[
                          styles.feedbackText,
                          item.feedback === "down" && styles.feedbackActive,
                        ]}
                      >
                        👎 Not useful
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          }}
        />

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Type a farming question…"
            placeholderTextColor="#6b7c6e"
            editable={!loading}
            multiline
            onSubmitEditing={() => ask(input)}
          />
          <Pressable
            style={[
              styles.send,
              (!input.trim() || loading) && styles.sendDisabled,
            ]}
            onPress={() => ask(input)}
            disabled={!input.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.sendText}>Send</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#eef5ea" },
  flex: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#d7e5d9",
    backgroundColor: "#eef5ea",
  },
  brand: { fontSize: 24, fontWeight: "700", color: "#1f3d2a" },
  subtitle: { fontSize: 13, color: "#4d6353", marginTop: 2 },
  status: { fontSize: 12, color: "#2f6b45", marginTop: 6 },
  list: { padding: 16, paddingBottom: 90, gap: 10 },
  suggestions: { gap: 8, marginBottom: 12 },
  suggestionsLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#5f7a64",
    textTransform: "uppercase",
  },
  chip: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#c5d6c8",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    cursor: "pointer",
  },
  chipText: { color: "#1f3d2a", fontSize: 14 },
  bubble: {
    maxWidth: "92%",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#2f6b45",
  },
  botBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d7e5d9",
  },
  tags: {
    fontSize: 11,
    color: "#5f7a64",
    marginBottom: 6,
    textTransform: "capitalize",
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 30,
    color: "#24382c",
    textAlignVertical: "top",
  },
  userText: { color: "#fff" },
  typing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    paddingVertical: 12,
    marginBottom: 10,
  },
  typingText: { fontSize: 13, color: "#5f7a64" },
  source: { marginTop: 8, fontSize: 11, color: "#5f7a64" },
  feedbackRow: { flexDirection: "row", gap: 12, marginTop: 10 },
  feedbackBtn: { paddingVertical: 2 },
  feedbackText: { fontSize: 12, color: "#5f7a64" },
  feedbackActive: { color: "#2f6b45", fontWeight: "700" },
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
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#c5d6c8",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    lineHeight: 24,
    color: "#1f3d2a",
    textAlignVertical: "center",
  },
  send: {
    backgroundColor: "#2f6b45",
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  sendDisabled: { opacity: 0.5 },
  sendText: { color: "#fff", fontWeight: "700" },
  disclaimer: {
    fontSize: 11,
    color: "#6b7c6e",
    textAlign: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});
