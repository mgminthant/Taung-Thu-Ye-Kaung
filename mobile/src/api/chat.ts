import { API_BASE_URL } from "../config";
import type { ChatApiResponse, ChatHistoryItem } from "./types";

export async function sendChat(
  message: string,
  history: ChatHistoryItem[],
  userId?: string,
): Promise<ChatApiResponse> {
  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history, user_id: userId ?? null }),
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
  /** prd.md §16 extras — sent on 👎 or when a chat id is known. */
  conversation_id?: string | null;
  reason?: string | null;
  comment?: string | null;
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

/** Callbacks for the streaming chat endpoint (Server-Sent Events). */
export type StreamHandlers = {
  /** Fired for each text delta as the answer is generated. */
  onToken?: (text: string) => void;
  /** Fired once with the full metadata payload (sources, intent, ...). */
  onDone?: (payload: ChatApiResponse) => void;
  /** Fired on transport/parse failure (so the caller can fall back). */
  onError?: (error: Error) => void;
};

/**
 * Stream a chat answer from `/chat/stream` (SSE). Each `data:` line is a JSON
 * event: `{type:"token",text}` chunks followed by one `{type:"done",payload}`.
 *
 * React Native's built-in `fetch` polyfill does NOT expose a readable
 * `response.body` stream, so the browser-style `ReadableStream` approach never
 * works on RN — the body arrives all at once and any attempt to read it as a
 * stream fails. We therefore use `XMLHttpRequest`, whose `onprogress` handler
 * exposes the incrementally-growing `responseText`, which lets us parse SSE
 * chunks as they arrive and stream tokens into the UI live.
 *
 * Platform note: this streams live on iOS (dev + release) and on Android
 * release builds. Android *dev/debug* builds buffer the whole response body
 * and only deliver it at completion, so tokens arrive all at once there —
 * that is a React Native limitation, not a bug; build a release APK/AAB to
 * see live streaming on Android.
 */
export async function sendChatStream(
  message: string,
  history: ChatHistoryItem[],
  userId: string | undefined,
  handlers: StreamHandlers,
): Promise<void> {
  const { onToken, onDone, onError } = handlers;

  const xhr = new XMLHttpRequest();
  xhr.open("POST", `${API_BASE_URL}/chat/stream`);
  xhr.responseType = "text";
  xhr.setRequestHeader("Content-Type", "application/json");

  let lastIndex = 0; // characters of responseText already consumed
  let tail = ""; // unparsed remainder of the SSE stream
  let doneReceived = false;

  // Append newly-arrived text, then parse every complete `data: {...}\n\n`
  // SSE event. `tail` only ever holds the unparsed remainder, so we never
  // re-consume bytes that were already turned into tokens.
  const ingest = (text: string) => {
    tail += text;
    let idx: number;
    while ((idx = tail.indexOf("\n\n")) !== -1) {
      const raw = tail.slice(0, idx);
      tail = tail.slice(idx + 2);
      const line = raw.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      const json = line.slice(5).trim();
      if (!json) continue;
      try {
        const ev = JSON.parse(json) as
          | { type: "token"; text: string }
          | { type: "done"; payload: ChatApiResponse };
        if (ev.type === "token") onToken?.(ev.text);
        else if (ev.type === "done") {
          doneReceived = true;
          onDone?.(ev.payload);
        }
      } catch {
        // Ignore partial / keep-alive lines that aren't valid JSON yet.
      }
    }
  };

  return new Promise<void>((resolve, reject) => {
    xhr.onprogress = () => {
      // responseText grows as chunks arrive; consume only the bytes we
      // haven't seen yet and feed them to the SSE parser.
      const newText = xhr.responseText.slice(lastIndex);
      lastIndex = xhr.responseText.length;
      ingest(newText);
    };

    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        const err = new Error(
          xhr.responseText || `Chat failed (${xhr.status})`,
        );
        onError?.(err);
        reject(err);
        return;
      }
      // Finalize any trailing events not terminated by a blank line.
      const newText = xhr.responseText.slice(lastIndex);
      lastIndex = xhr.responseText.length;
      ingest(newText);
      if (!doneReceived) {
        const err = new Error("Stream ended without a done event");
        onError?.(err);
        reject(err);
        return;
      }
      resolve();
    };

    xhr.onerror = () => {
      const err = new Error("Network error while streaming chat");
      onError?.(err);
      reject(err);
    };

    xhr.send(
      JSON.stringify({ message, history, user_id: userId ?? null }),
    );
  });
}
