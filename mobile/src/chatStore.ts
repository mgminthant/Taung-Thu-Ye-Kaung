import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Conversation, UiMessage } from "./api/types";

const KEY_PREFIX = "farmerbot.conversations.";

function keyFor(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

export function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function makeConversation(messages?: UiMessage[]): Conversation {
  const now = Date.now();
  return {
    id: makeId(),
    title: "New chat",
    messages: messages ?? [],
    createdAt: now,
    updatedAt: now,
  };
}

/** Pull a short title out of the first real user message, ChatGPT-style. */
export function titleForMessages(messages: UiMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "New chat";
  const clean = first.content.replace(/\s+/g, " ").trim();
  return clean.length > 28 ? `${clean.slice(0, 28).trim()}…` : clean || "New chat";
}

export async function loadConversations(userId: string): Promise<Conversation[]> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveConversations(userId: string, list: Conversation[]): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(list));
  } catch {
    // best-effort local persistence; ignore write failures
  }
}
