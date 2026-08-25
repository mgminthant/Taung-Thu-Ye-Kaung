/** Notify the backend to sync its vector index after an article change. */

const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

/**
 * Tell the backend to apply a single-article change to its vector index.
 *
 * `operation` is "create" | "update" | "delete" and `id` is the article id;
 * the backend then embeds/removes just that one record instead of re-indexing
 * the whole KB. Retries a few times with backoff because a transient backend
 * blip must not leave the portal's SQLite out of sync with the mobile bot's
 * vector store. Throws on final failure so the caller can surface a visible
 * warning to the admin (don't swallow silently).
 */
export async function syncKnowledgeBase(
  operation: "create" | "update" | "delete",
  id: string,
  attempt = 0,
): Promise<void> {
  const maxAttempts = 3;
  try {
    const res = await fetch(`${BACKEND_URL}/sync-knowledge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation, id }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`Backend sync failed (${res.status}): ${JSON.stringify(data)}`);
    }
    console.log("[sync] knowledge updated:", data);
  } catch (err) {
    if (attempt + 1 < maxAttempts) {
      console.warn(`[sync] attempt ${attempt + 1} failed, retrying...`, err);
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      return syncKnowledgeBase(operation, id, attempt + 1);
    }
    throw new Error(
      `Backend sync failed after ${maxAttempts} attempts: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

/**
 * Trigger a full reload of the backend's vector index (no single article id).
 * Used by batch operations and the manual "sync now" endpoint; the backend
 * falls back to re-indexing the whole KB when no `{operation, id}` is given.
 */
export async function syncKnowledgeBaseFull(attempt = 0): Promise<void> {
  const maxAttempts = 3;
  try {
    const res = await fetch(`${BACKEND_URL}/sync-knowledge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`Backend sync failed (${res.status}): ${JSON.stringify(data)}`);
    }
    console.log("[sync] knowledge reloaded:", data);
  } catch (err) {
    if (attempt + 1 < maxAttempts) {
      console.warn(`[sync] attempt ${attempt + 1} failed, retrying...`, err);
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      return syncKnowledgeBaseFull(attempt + 1);
    }
    throw new Error(
      `Backend sync failed after ${maxAttempts} attempts: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

