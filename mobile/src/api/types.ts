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
