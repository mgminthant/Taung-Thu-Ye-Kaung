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
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated } from "react-native";

import { sendChat, sendChatStream, sendFeedback } from "../api/chat";
import type {
  ChatHistoryItem,
  Conversation,
  UiMessage,
} from "../api/types";
import { makeWelcomeMessage, WELCOME_MESSAGE_ID } from "../api/types";
import {
  loadConversations,
  makeConversation,
  makeId,
  saveConversations,
  titleForMessages,
} from "../chatStore";
import { formatReply } from "../format";
import { API_BASE_URL } from "../config";
import { useAuth } from "./useAuth";
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
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Animation value that drives the drawer: 0 = closed, 1 = fully open.
  const drawerProgress = useRef(new Animated.Value(0)).current;
  // Mirrors `drawerOpen` without triggering re-renders (used inside callbacks).
  const drawerOpenRef = useRef(false);

  // Latest messages/activeId for stable callbacks (so toggleFeedback keeps a
  // fixed identity and React.memo on MessageBubble actually prevents
  // re-rendering every bubble on each streamed token).
  const messagesRef = useRef<UiMessage[]>([]);
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;
  const loadingRef = useRef(loading);
  loadingRef.current = loading;

  // ---- Derived values -------------------------------------------------

  const active = conversations.find((c) => c.id === activeId) ?? null;
  const messages = active?.messages ?? [];
  messagesRef.current = messages;

  // A conversation is "fresh" when it only contains the welcome message.
  const isFreshActive =
    !!active &&
    active.title === "New chat" &&
    !active.messages.some((m) => m.role === "user");

  // History list excludes fresh chats so they don't clutter the drawer.
  const historyConversations = conversations.filter(
    (c) => !(c.title === "New chat" && !c.messages.some((m) => m.role === "user")),
  );

  // ---- Startup: load history + start fresh chat --------------------------

  useEffect(() => {
    (async () => {
      const uid = user?.userId ?? "anonymous";
      const saved = user?.isGuest ? [] : await loadConversations(uid);
      // Always create a new conversation on launch.
      const fresh = makeConversation([makeWelcomeMessage(t.welcome)]);
      const next = [...saved, fresh];
      await saveConversations(uid, next);
      setConversations(next);
      setActiveId(fresh.id);
      setHydrated(true);
    })();
  }, [user?.userId]);

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

  // Persist conversations whenever they change — skip for guest users.
  useEffect(() => {
    if (!hydrated || user?.isGuest) return;
    const uid = user?.userId ?? "anonymous";
    saveConversations(uid, conversations);
  }, [conversations, hydrated, user?.isGuest, user?.userId]);

  // ---- Helpers ---------------------------------------------------------

  // Stable: keeps `sendMessage`/`toggleFeedback` identities fixed so memoized
  // children don't re-render on every streamed token.
  const updateConversation = useCallback(
    (id: string, fn: (c: Conversation) => Conversation) => {
      setConversations((prev) => prev.map((c) => (c.id === id ? fn(c) : c)));
    },
    [setConversations],
  );

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

  const userId = user?.userId;
  const sendMessage = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || loadingRef.current || !activeIdRef.current) return;

      const convoId = activeIdRef.current;
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

    // Reserve an id for the assistant bubble, but only insert it into the
    // conversation once the first token (or the final answer) arrives. Creating
    // it empty up-front left a blank bubble sitting next to the typing
    // indicator during the whole load.
    const botId = makeId();
    let botCreated = false;

    const ensureBot = (initial: Partial<UiMessage>) => {
      if (botCreated) return;
      botCreated = true;
      updateConversation(convoId, (c) => ({
        ...c,
        messages: [
          ...c.messages,
          {
            id: botId,
            role: "assistant",
            content: "",
            feedback: null,
            streaming: true,
            ...initial,
          },
        ],
        updatedAt: Date.now(),
      }));
    };

    // Apply a partial update to the streaming assistant bubble.
    const patchBot = (patch: Partial<UiMessage>) =>
      updateConversation(convoId, (c) => ({
        ...c,
        messages: c.messages.map((m) =>
          m.id === botId ? { ...m, ...patch } : m,
        ),
        updatedAt: Date.now(),
      }));

    let acc = "";
    try {
      await sendChatStream(text, historyForApi(messagesRef.current), userId, {
        onToken: (t) => {
          acc += t;
          // Format the live accumulator so the streamed view matches the
          // finished (backend-formatted) answer instead of showing raw
          // markdown like ** / ## mid-stream.
          const formatted = formatReply(acc);
          // Create the bubble on the very first token so it fills live.
          ensureBot({ content: formatted });
          patchBot({ content: formatted });
        },
        onDone: (payload) => {
          // Swap the raw streamed text for the formatted final answer.
          ensureBot({});
          patchBot({
            content: payload.answer ?? formatReply(acc),
            crop: payload.crop,
            topic: payload.topic,
            intent: payload.intent,
            sources: payload.sources ?? [],
            usedLlm: payload.used_llm,
            outOfScope: payload.out_of_scope,
            needsClarification: payload.needs_clarification ?? false,
            insufficientKnowledge: payload.insufficient_knowledge ?? false,
            entities: payload.entities ?? null,
            streaming: false,
          });
        },
        onError: (e) => {
          throw e;
        },
      });
    } catch (err) {
      // Streaming failed (or runtime lacks SSE support): fall back to the
      // non-streaming endpoint, then surface a backend-down message.
      try {
        const result = await sendChat(text, historyForApi(messagesRef.current), userId);
        ensureBot({});
        patchBot({
          content: result.answer,
          crop: result.crop,
          topic: result.topic,
          intent: result.intent,
          sources: result.sources,
          usedLlm: result.used_llm,
          outOfScope: result.out_of_scope,
          needsClarification: result.needs_clarification ?? false,
          insufficientKnowledge: result.insufficient_knowledge ?? false,
          streaming: false,
        });
      } catch (err2) {
        const message =
          err2 instanceof Error ? err2.message : "Could not reach the backend.";
        ensureBot({});
        patchBot({ content: backendErrorText(message), streaming: false });
      }
    } finally {
      setLoading(false);
    }
    },
    [updateConversation, setLoading, userId],
  );

  const toggleFeedback = useCallback(
    async (msg: UiMessage, useful: boolean, reason?: string, comment?: string) => {
      const activeId = activeIdRef.current;
      if (!activeId) return;
      // Send feedback against the last user question that triggered this answer.
      const lastUser = [...messagesRef.current]
        .reverse()
        .find((m) => m.role === "user");
      if (!lastUser) return;
      try {
        await sendFeedback({
          message: lastUser.content,
          answer: msg.content,
          useful,
          source_ids: (msg.sources ?? []).map((s) => s.id),
          conversation_id: activeId,
          reason: reason ?? null,
          comment: comment ?? null,
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
    },
    [],
  );

  // Toggle-off: clear the thumb on one message (UI only, no re-submit).
  const clearFeedback = useCallback(
    (msg: UiMessage) => {
      const activeId = activeIdRef.current;
      if (!activeId) return;
      updateConversation(activeId, (c) => ({
        ...c,
        messages: c.messages.map((m) =>
          m.id === msg.id ? { ...m, feedback: null } : m,
        ),
      }));
    },
    [updateConversation],
  );

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
    clearFeedback,
  };
}
