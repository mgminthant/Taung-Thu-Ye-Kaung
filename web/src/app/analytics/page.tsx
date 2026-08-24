import Link from "next/link";
import { prisma } from "@/lib/db";
import { getTranslations } from "@/lib/get-locale";
import { CategoryBarChart } from "@/components/charts";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const t = await getTranslations();

  const feedback = await prisma.feedback.findMany({
    orderBy: { ts: "asc" },
    take: 2000,
  });

  const byDay = new Map<string, { useful: number; notUseful: number }>();
  for (const f of feedback) {
    const day = f.ts.toISOString().slice(0, 10);
    const cur = byDay.get(day) ?? { useful: 0, notUseful: 0 };
    if (f.useful) cur.useful++;
    else cur.notUseful++;
    byDay.set(day, cur);
  }
  const trendData = [...byDay.entries()].map(([day, v]) => ({
    name: day.slice(5),
    useful: v.useful,
    notUseful: v.notUseful,
  }));

  const refs = new Map<string, number>();
  for (const f of feedback) {
    let ids: string[] = [];
    try {
      ids = JSON.parse(f.sourceIds);
    } catch {
      ids = [];
    }
    for (const id of ids) {
      refs.set(id, (refs.get(id) ?? 0) + 1);
    }
  }
  const topArticles = await prisma.article.findMany({
    where: { id: { in: [...refs.keys()] } },
    select: { id: true, title: true },
  });
  const titleById = new Map(topArticles.map((a) => [a.id, a.title]));
  const refData = [...refs.entries()]
    .map(([id, count]) => ({ id, title: titleById.get(id) ?? id, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const totalFeedback = feedback.length;
  const useful = feedback.filter((f) => f.useful).length;
  const usefulPct = totalFeedback ? Math.round((useful / totalFeedback) * 100) : 0;

  const logs = await prisma.questionLog.findMany({
    orderBy: { ts: "desc" },
    take: 5000,
  });

  const totalQuestions = logs.length;

  const intentCounts = new Map<string, number>();
  for (const l of logs) {
    const intent = l.intent ?? "unknown";
    intentCounts.set(intent, (intentCounts.get(intent) ?? 0) + 1);
  }
  const intentData = [...intentCounts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const questionsByDay = new Map<string, number>();
  for (const l of logs) {
    const day = l.ts.toISOString().slice(0, 10);
    questionsByDay.set(day, (questionsByDay.get(day) ?? 0) + 1);
  }
  const questionsTrend = [...questionsByDay.entries()]
    .map(([name, value]) => ({ name: name.slice(5), value }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const rtBuckets: Record<string, number> = { "<500": 0, "500-1k": 0, "1-3s": 0, "3s+": 0 };
  for (const l of logs) {
    const ms = l.responseMs ?? 0;
    if (ms < 500) rtBuckets["<500"]++;
    else if (ms < 1000) rtBuckets["500-1k"]++;
    else if (ms < 3000) rtBuckets["1-3s"]++;
    else rtBuckets["3s+"]++;
  }
  const rtData = Object.entries(rtBuckets).map(([name, value]) => ({ name, value }));

  const llmCount = logs.filter((l) => l.usedLlm).length;
  const llmPct = totalQuestions ? Math.round((llmCount / totalQuestions) * 100) : 0;

  const oosCount = logs.filter((l) => l.outOfScope).length;
  const oosPct = totalQuestions ? Math.round((oosCount / totalQuestions) * 100) : 0;

  const questionCounts = new Map<string, { count: number; intent: string }>();
  for (const l of logs) {
    const q = l.question.trim().toLowerCase();
    const cur = questionCounts.get(q);
    if (cur) cur.count++;
    else questionCounts.set(q, { count: 1, intent: l.intent ?? "" });
  }
  const topQuestions = [...questionCounts.entries()]
    .map(([q, v]) => ({ question: q, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t.analytics.title}</h1>
        <p className="text-sm text-muted">{t.analytics.subtitle}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <p className="text-sm text-muted">{t.analytics.totalQuestions}</p>
          <p className="mt-2 text-3xl font-semibold text-primary">{totalQuestions}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <p className="text-sm text-muted">{t.analytics.totalFeedback}</p>
          <p className="mt-2 text-3xl font-semibold text-primary">{totalFeedback}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <p className="text-sm text-muted">{t.analytics.usefulRate}</p>
          <p className="mt-2 text-3xl font-semibold text-primary">{usefulPct}%</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <p className="text-sm text-muted">{t.analytics.llmFallbackRate}</p>
          <p className="mt-2 text-3xl font-semibold text-primary">{llmPct}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-medium text-primary-dark">
            {t.analytics.intentDistribution}
          </h2>
          {intentData.length ? (
            <CategoryBarChart data={intentData} />
          ) : (
            <p className="text-sm text-muted">{t.analytics.noData}</p>
          )}
        </section>
        <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-medium text-primary-dark">
            {t.analytics.questionsPerDay}
          </h2>
          {questionsTrend.length ? (
            <CategoryBarChart data={questionsTrend} />
          ) : (
            <p className="text-sm text-muted">{t.analytics.noData}</p>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-medium text-primary-dark">
            {t.analytics.responseTimeDistribution}
          </h2>
          {rtData.some((d) => d.value > 0) ? (
            <CategoryBarChart data={rtData} />
          ) : (
            <p className="text-sm text-muted">{t.analytics.noData}</p>
          )}
        </section>
        <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-medium text-primary-dark">
            {t.analytics.feedbackPerDay}
          </h2>
          {trendData.length ? (
            <CategoryBarChart
              data={trendData.map((d) => ({
                name: d.name,
                value: d.useful + d.notUseful,
              }))}
            />
          ) : (
            <p className="text-sm text-muted">{t.analytics.noData}</p>
          )}
        </section>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <p className="text-sm text-muted">{t.analytics.llmCalls}</p>
          <p className="mt-2 text-3xl font-semibold text-[#2980b9]">{llmCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <p className="text-sm text-muted">{t.analytics.outOfScope}</p>
          <p className="mt-2 text-3xl font-semibold text-danger">{oosCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <p className="text-sm text-muted">{t.analytics.outOfScopeRate}</p>
          <p className="mt-2 text-3xl font-semibold text-danger">{oosPct}%</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <p className="text-sm text-muted">{t.analytics.uniqueArticlesCited}</p>
          <p className="mt-2 text-3xl font-semibold text-primary">{refs.size}</p>
        </div>
      </div>

      <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-medium text-primary-dark">
          {t.analytics.mostCitedArticles}
        </h2>
        {refData.length ? (
          <ol className="space-y-2">
            {refData.map((r, i) => (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-md bg-surface-accent px-3 py-2"
              >
                <span className="w-6 text-center text-sm font-medium text-muted-light">
                  {i + 1}
                </span>
                <span className="flex-1 truncate text-sm">
                  <Link
                    href={`/knowledge/${r.id}`}
                    className="text-foreground hover:text-primary hover:underline"
                  >
                    {r.title}
                  </Link>
                </span>
                <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-white">
                  {r.count}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted">{t.analytics.noData}</p>
        )}
      </section>

      <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-medium text-primary-dark">
          {t.analytics.mostAskedQuestions}
        </h2>
        {topQuestions.length ? (
          <ol className="space-y-2">
            {topQuestions.map((q, i) => (
              <li
                key={`${q.question}-${i}`}
                className="flex items-center gap-3 rounded-md bg-surface-accent px-3 py-2"
              >
                <span className="w-6 text-center text-sm font-medium text-muted-light">
                  {i + 1}
                </span>
                <span className="flex-1 truncate text-sm text-foreground">
                  {q.question}
                </span>
                <span className="rounded-full bg-warning px-2 py-0.5 text-xs font-medium text-white">
                  {q.intent}
                </span>
                <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-white">
                  {q.count}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted">{t.analytics.noData}</p>
        )}
      </section>
    </div>
  );
}
