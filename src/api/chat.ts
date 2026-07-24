import { API_BASE_URL } from "../config";
import type { ChatApiResponse, ChatHistoryItem } from "./types";

export async function sendChat(
  message: string,
  history: ChatHistoryItem[],
): Promise<ChatApiResponse> {
  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Chat failed (${response.status})`);
  }

  return response.json() as Promise<ChatApiResponse>;
}

export async function sendFeedback(payload: {
  message: string;
  answer: string;
  useful: boolean;
  source_ids: string[];
}): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Feedback failed (${response.status})`);
  }
}

export async function checkHealth(): Promise<{
  status: string;
  knowledge_count: number;
  openrouter_configured: boolean;
  model: string;
}> {
  const response = await fetch(`${API_BASE_URL}/health`);
  if (!response.ok) {
    throw new Error(`Health check failed (${response.status})`);
  }
  return response.json();
}
