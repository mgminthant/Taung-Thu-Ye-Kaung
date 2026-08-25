/**
 * formatReply — client-side twin of backend `format_gemini_reply`.
 *
 * The streaming endpoint sends raw LLM tokens, and only the final
 * `payload.answer` is pre-formatted by the backend. To keep the live,
 * token-by-token view consistent with the finished answer, we run the same
 * markdown-stripping here on the accumulated text. Keep this in sync with
 * `backend/app/llm.py:format_gemini_reply`.
 */
export function formatReply(text: string): string {
  let t = text;
  // Drop <think>...</think> reasoning traces.
  t = t.replace(/<think>[\s\S]*?<\/think>/gi, "");
  // Bullets: "* " / "- " -> "• ".
  t = t.replace(/^[ \t]*[\*\-]\s+/gm, "• ");
  // Strip emphasis / inline-code markers and any stray "*".
  t = t.split("**").join("").split("`").join("").split("*").join("");
  // Headings: drop leading "#" runs at line start.
  t = t.replace(/^[ \t]{0,3}#{1,6}\s*/gm, "");
  // Trim trailing spaces on each line.
  t = t.replace(/[ \t]+$/gm, "");
  // Collapse 3+ newlines into 2.
  t = t.replace(/\n{3,}/g, "\n\n");
  return t;
}
