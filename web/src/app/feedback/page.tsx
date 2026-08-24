import Link from "next/link";
import { Pencil, ThumbsDown, ThumbsUp } from "lucide-react";
import { prisma } from "@/lib/db";
import { getTranslations } from "@/lib/get-locale";

export const dynamic = "force-dynamic";

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ useful?: string }>;
}) {
  const t = await getTranslations();
  const { useful } = await searchParams;

  const items = await prisma.feedback.findMany({
    where: useful === "true" || useful === "false" ? { useful: useful === "true" } : {},
    orderBy: { ts: "desc" },
    take: 200,
  });

  const usefulCount = await prisma.feedback.count({ where: { useful: true } });
  const notUsefulCount = await prisma.feedback.count({ where: { useful: false } });

  // Not-useful rows often have no cited article. Match the question text
  // against the knowledge base so "Update" opens the closest article instead
  // of a blank form; ?add=1 (new article) is the fallback.
  const kb = await prisma.article.findMany({
    select: { id: true, title: true, content: true },
  });
  const bestMatch = (question: string): string | null => {
    const tokens = question
      .split(/[\s,.!?၊။:;]+/u)
      .filter((w) => w.length >= 2);
    if (tokens.length === 0) return null;
    // Burmese text is not space-delimited: also accept the leading ~word of a
    // long unbroken token (e.g. "ငရုတ်ပင်အတွက်ပါ" -> "ငရုတ်").
    const hits = (hay: string, w: string) =>
      hay.includes(w) || (w.length >= 8 && hay.includes(w.slice(0, 5)));
    let best: { id: string; score: number } | null = null;
    for (const a of kb) {
      let score = 0;
      for (const w of tokens) {
        if (hits(a.title, w)) score += 2; // title match outweighs a mention
        else if (hits(a.content, w)) score += 1;
      }
      if (score > 0 && (!best || score > best.score)) best = { id: a.id, score };
    }
    return best?.id ?? null;
  };

  const tabCls = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
      active
        ? "bg-primary text-white"
        : "text-muted hover:bg-surface-accent"
    }`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t.feedback.title}</h1>
      </div>

      <div className="flex items-center gap-1 rounded-lg bg-surface-accent p-1 w-fit">
        <Link href="/feedback" className={tabCls(!useful)}>
          {t.feedback.all} ({usefulCount + notUsefulCount})
        </Link>
        <Link href="/feedback?useful=true" className={tabCls(useful === "true")}>
          {t.feedback.useful} ({usefulCount})
        </Link>
        <Link href="/feedback?useful=false" className={tabCls(useful === "false")}>
          {t.feedback.notUseful} ({notUsefulCount})
        </Link>
      </div>

      <div className="space-y-4">
        {items.map((f) => {
          let sources: string[] = [];
          try {
            sources = JSON.parse(f.sourceIds);
          } catch {
            sources = [];
          }
          const editTarget = f.useful
            ? null
            : (sources[0] ?? bestMatch(f.message));
          return (
            <div
              key={f.id}
              className="rounded-xl border border-border bg-surface p-5 shadow-sm"
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {f.useful ? (
                    <span className="flex items-center gap-1 rounded-full bg-primary-muted px-2 py-0.5 text-xs font-medium text-primary">
                      <ThumbsUp className="size-3" /> {t.feedback.useful}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 rounded-full bg-danger-muted px-2 py-0.5 text-xs font-medium text-danger">
                      <ThumbsDown className="size-3" /> {t.feedback.notUseful}
                    </span>
                  )}
                  <span className="text-xs text-muted-light">
                    {f.ts.toISOString().slice(0, 19).replace("T", " ")}
                  </span>
                </div>
              </div>
              <p className="text-sm font-medium text-foreground">&quot;{f.message}&quot;</p>
              <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-muted">
                {f.answer}
              </p>
              {sources.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {sources.map((s) => (
                    <Link
                      key={s}
                      href={`/knowledge/${s}`}
                      className="rounded bg-surface-accent px-2 py-0.5 font-mono text-xs text-primary hover:bg-primary-muted"
                    >
                      {s}
                    </Link>
                  ))}
                </div>
              )}
              {!f.useful && (
                <Link
                  href={
                    editTarget
                      ? `/knowledge?edit=${encodeURIComponent(editTarget)}`
                      : "/knowledge?add=1"
                  }
                  className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-light"
                >
                  <Pencil className="size-3.5" /> {t.feedback.update}
                </Link>
              )}
              {(f.reason || f.comment || f.conversationId) && (
                <div className="mt-3 space-y-1.5 rounded-lg bg-surface-accent p-3">
                  {f.reason && (
                    <p className="text-xs">
                      <span className="font-medium text-foreground">
                        {t.feedback.reason}:
                      </span>{" "}
                      <span className="text-muted">{f.reason}</span>
                    </p>
                  )}
                  {f.comment && (
                    <p className="text-sm italic text-muted">&ldquo;{f.comment}&rdquo;</p>
                  )}
                  {f.conversationId && (
                    <p className="font-mono text-[11px] text-muted-light">
                      {t.feedback.conversation}: {f.conversationId}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {items.length === 0 && (
          <p className="py-10 text-center text-sm text-muted">
            {t.feedback.noFeedback}
          </p>
        )}
      </div>
    </div>
  );
}
