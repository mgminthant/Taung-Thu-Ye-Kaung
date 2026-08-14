export type ChatRole = "user" | "assistant";

export type ChatHistoryItem = {
  role: ChatRole;
  content: string;
};

export type RetrievedSource = {
  id: string;
  crop: string;
  topic: string;
  score: number;
  question: string;
};

export type ChatApiResponse = {
  answer: string;
  crop: string | null;
  topic: string | null;
  intent: string | null;
  sources: RetrievedSource[];
  out_of_scope: boolean;
  used_llm: boolean;
  model: string | null;
};

export type UiMessage = {
  id: string;
  role: ChatRole;
  content: string;
  crop?: string | null;
  topic?: string | null;
  intent?: string | null;
  sources?: RetrievedSource[];
  usedLlm?: boolean;
  outOfScope?: boolean;
  feedback?: "up" | "down" | null;
};

export type Conversation = {
  id: string;
  title: string;
  messages: UiMessage[];
  createdAt: number;
  updatedAt: number;
};

export const WELCOME_MESSAGE_ID = "welcome";

/** Build the assistant welcome bubble with a localized greeting. */
export function makeWelcomeMessage(content: string): UiMessage {
  return { id: WELCOME_MESSAGE_ID, role: "assistant", content };
}
