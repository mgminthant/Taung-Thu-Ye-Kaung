/**
 * useChat — central state hook for the whole chat experience.
 *
 * Owns:
 *  - the list of conversations and which one is active
 *  - loading conversations from local storage on startup
 *  - persisting conversations + active id back to storage
 *  - the drawer open state and its slide animation
 *  - sending messages to the backend and recording feedback
 *
 * UI components receive plain props + callbacks from here, so they stay
 * "dumb" and easy to read.
 */
import { useEffect, useRef, useState } from "react";
import { Animated } from "react-native";

import { sendChat, sendFeedback } from "../api/chat";
import type {
  ChatHistoryItem,
  Conversation,
  UiMessage,
} from "../api/types";
import { makeWelcomeMessage, WELCOME_MESSAGE_ID } from "../api/types";
import {
  loadActiveId,
  loadConversations,
  makeConversation,
  makeId,
  saveActiveId,
  saveConversations,
  titleForMessages,
} from "../chatStore";
import { API_BASE_URL } from "../config";
import { useSettings } from "../settings";

/** Format the last few messages for the API so the model has context. */
function historyForApi(msgs: UiMessage[]): ChatHistoryItem[] {
  return msgs
    .filter((m) => m.id !== "welcome")
    .slice(-6)
    .map((m) => ({ role: m.role, content: m.content }));
}

/** Build the "backend is down" assistant message with run instructions. */
function backendErrorText(message: string): string {
  return `Backend error: ${message}\n\nStart the API with:\ncd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000\n\nAPI URL: ${API_BASE_URL}`;
}

export function useChat() {
  const { t } = useSettings();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Animation value that drives the drawer: 0 = closed, 1 = fully open.
  const drawerProgress = useRef(new Animated.Value(0)).current;
  // Mirrors `drawerOpen` without triggering re-renders (used inside callbacks).
  const drawerOpenRef = useRef(false);

  // ---- Derived values -------------------------------------------------

  const active = conversations.find((c) => c.id === activeId) ?? null;
  const messages = active?.messages ?? [];

  // A conversation is "fresh" when it only contains the welcome message.
  const isFreshActive =
    !!active &&
    active.title === "New chat" &&
    !active.messages.some((m) => m.role === "user");

  // History list excludes fresh chats so they don't clutter the drawer.
  const historyConversations = conversations.filter(
    (c) => !(c.title === "New chat" && !c.messages.some((m) => m.role === "user")),
  );

  // ---- Startup: load saved state --------------------------------------

  useEffect(() => {
    (async () => {
      const [list, storedActive] = await Promise.all([
        loadConversations(),
        loadActiveId(),
      ]);
      // First ever launch: create one welcome conversation.
      let next = list.length > 0 ? list : [makeConversation([makeWelcomeMessage(t.welcome)])];
      if (list.length === 0) {
        await saveConversations(next);
      }
      // Fall back to the most recent chat if the saved id is stale.
      const valid = next.some((c) => c.id === storedActive);
      const id = valid ? storedActive! : next[next.length - 1].id;
      setConversations(next);
      setActiveId(id);
      setHydrated(true);
    })();
  }, []);

  // Re-localize the stored greeting whenever the UI language changes so
  // existing (persisted) conversations show the welcome message in the
  // active language instead of the language it was created in.
  useEffect(() => {
    if (!hydrated) return;
    setConversations((prev) => {
      let changed = false;
      const next = prev.map((c) => {
        const messages = c.messages.map((m) => {
          if (m.id === WELCOME_MESSAGE_ID && m.content !== t.welcome) {
            changed = true;
            return { ...m, content: t.welcome };
          }
          return m;
        });
        return messages === c.messages ? c : { ...c, messages };
      });
      return changed ? next : prev;
    });
  }, [t.welcome, hydrated]);

  // Persist conversations whenever they change.
  useEffect(() => {
    if (!hydrated) return;
    saveConversations(conversations);
  }, [conversations, hydrated]);

  // Persist the last open conversation id.
  useEffect(() => {
    if (hydrated && activeId) saveActiveId(activeId);
  }, [activeId, hydrated]);

  // ---- Helpers ---------------------------------------------------------

  const updateConversation = (
    id: string,
    fn: (c: Conversation) => Conversation,
  ) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? fn(c) : c)));
  };

  // ---- Drawer ----------------------------------------------------------

  const openDrawer = () => {
    drawerOpenRef.current = true;
    setDrawerOpen(true);
    Animated.timing(drawerProgress, {
      toValue: 1,
      duration: 240,
      useNativeDriver: true,
    }).start();
  };

  const closeDrawer = () => {
    Animated.timing(drawerProgress, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      drawerOpenRef.current = false;
      setDrawerOpen(false);
    });
  };

  // ---- Conversation actions --------------------------------------------

  const newChat = () => {
    if (drawerOpenRef.current) closeDrawer();
    const convo = makeConversation([makeWelcomeMessage(t.welcome)]);
    setConversations((prev) => [...prev, convo]);
    setActiveId(convo.id);
  };

  const openConversation = (id: string) => {
    setActiveId(id);
    if (drawerOpenRef.current) closeDrawer();
  };

  const deleteConversation = (id: string) => {
    setConversations((prev) => {
      const rest = prev.filter((c) => c.id !== id);
      // Never leave the app with zero conversations.
      if (rest.length === 0) {
        const fresh = makeConversation([makeWelcomeMessage(t.welcome)]);
        setActiveId(fresh.id);
        return [fresh];
      }
      // If the deleted chat was open, jump to the most recent remaining one.
      if (id === activeId) {
        setActiveId(rest[rest.length - 1].id);
      }
      return rest;
    });
  };

  const renameConversation = (id: string, title: string) => {
    updateConversation(id, (c) => ({ ...c, title }));
  };

  // ---- Chatting --------------------------------------------------------

  const sendMessage = async (raw: string) => {
    const text = raw.trim();
    if (!text || loading || !activeId) return;

    const convoId = activeId;
    const userMsg: UiMessage = { id: makeId(), role: "user", content: text };

    // Append the user message and auto-title the chat on first message.
    updateConversation(convoId, (c) => ({
      ...c,
      title:
        c.title === "New chat"
          ? titleForMessages([...c.messages, userMsg])
          : c.title,
      messages: [...c.messages, userMsg],
      updatedAt: Date.now(),
    }));
    setLoading(true);

    try {
      const result = await sendChat(text, historyForApi(messages));
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
      updateConversation(convoId, (c) => ({
        ...c,
        messages: [...c.messages, assistantMsg],
        updatedAt: Date.now(),
      }));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not reach the backend.";
      updateConversation(convoId, (c) => ({
        ...c,
        messages: [
          ...c.messages,
          { id: makeId(), role: "assistant", content: backendErrorText(message) },
        ],
        updatedAt: Date.now(),
      }));
    } finally {
      setLoading(false);
    }
  };

  const toggleFeedback = async (msg: UiMessage, useful: boolean) => {
    if (!activeId) return;
    // Send feedback against the last user question that triggered this answer.
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    try {
      await sendFeedback({
        message: lastUser.content,
        answer: msg.content,
        useful,
        source_ids: (msg.sources ?? []).map((s) => s.id),
      });
      updateConversation(activeId, (c) => ({
        ...c,
        messages: c.messages.map((m) =>
          m.id === msg.id ? { ...m, feedback: useful ? "up" : "down" } : m,
        ),
      }));
    } catch {
      // Feedback is best-effort; ignore failures.
    }
  };

  return {
    hydrated,
    conversations,
    activeId,
    active,
    messages,
    isFreshActive,
    historyConversations,
    loading,
    drawerOpen,
    drawerProgress,
    openDrawer,
    closeDrawer,
    newChat,
    openConversation,
    deleteConversation,
    renameConversation,
    sendMessage,
    toggleFeedback,
  };
}
