export type ChatRole = "user" | "assistant";

export type ChatHistoryItem = {
  role: ChatRole;
  content: string;
};

/** Structured intent + NER output from the backend (prd.md §8–§10). */
export type IntentNerEntities = {
  intent: string;
  crop: string | null;
  disease: string | null;
  pest: string | null;
  symptom: string | null;
  fertilizer: string | null;
  pesticide: string | null;
  plant_part: string | null;
  location: string | null;
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
  entities?: IntentNerEntities | null;
  sources: RetrievedSource[];
  out_of_scope: boolean;
  used_llm: boolean;
  needs_clarification?: boolean;
  insufficient_knowledge?: boolean;
  model: string | null;
};

export type UiMessage = {
  id: string;
  role: ChatRole;
  content: string;
  crop?: string | null;
  topic?: string | null;
  intent?: string | null;
  entities?: IntentNerEntities | null;
  sources?: RetrievedSource[];
  usedLlm?: boolean;
  outOfScope?: boolean;
  needsClarification?: boolean;
  insufficientKnowledge?: boolean;
  streaming?: boolean;
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
