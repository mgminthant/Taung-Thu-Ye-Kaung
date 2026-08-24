import Link from "next/link";
import { BookOpenText, HelpCircle, MessageSquareText, Users, XCircle } from "lucide-react";
import { prisma } from "@/lib/db";
import { getTranslations } from "@/lib/get-locale";
import { CATEGORY_LABELS } from "@/lib/constants";
import { CategoryBarChart, CropPieChart } from "@/components/charts";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const t = await getTranslations();

  const [articles, totalQuestions, logs, activeUserCount] =
    await Promise.all([
      prisma.article.count(),
      prisma.questionLog.count(),
      prisma.questionLog.findMany({
        select: { sourceIds: true, outOfScope: true },
      }),
      prisma.questionLog.findMany({
        where: { userId: { not: null } },
        select: { userId: true },
        distinct: ["userId"],
      }).then((rows) => rows.length),
    ]);

  // Unknown = no KB articles cited AND not out-of-scope
  const unknownCount = logs.filter((l) => {
    if (l.outOfScope) return false;
    if (!l.sourceIds) return true;
    try {
      const ids = JSON.parse(l.sourceIds);
      return !Array.isArray(ids) || ids.length === 0;
    } catch {
      return true;
    }
  }).length;

  const [byCategory, byCrop] = await Promise.all([
    prisma.articleCategory.groupBy({
      by: ["category"],
      _count: { _all: true },
    }),
    prisma.articleCrop.groupBy({
      by: ["crop"],
      _count: { _all: true },
    }),
  ]);

  const categoryData = byCategory.map((g) => ({
    name: CATEGORY_LABELS[g.category] ?? g.category,
    value: g._count._all,
  }));
  const cropData = byCrop.map((g) => ({
    name: g.crop,
    value: g._count._all,
  }));

  const stats = [
    { label: t.dashboard.knowledgeArticles, value: articles, icon: BookOpenText },
    { label: t.dashboard.questionsAsked, value: totalQuestions, icon: MessageSquareText },
    { label: t.dashboard.unknownQuestions, value: unknownCount, icon: HelpCircle },
    { label: t.dashboard.activeUsers, value: activeUserCount, icon: Users },
  ];

  const flaggedCount = unknownCount;
  const reviewText = t.dashboard.flaggedFeedback
    .replace("{count}", String(flaggedCount));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t.dashboard.title}</h1>
        <p className="text-sm text-muted">{t.dashboard.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="rounded-xl border border-border bg-surface p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted">{label}</p>
              <Icon className="size-4 text-primary-light" />
            </div>
            <p className="mt-2 text-3xl font-semibold text-primary">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-medium text-primary-dark">
            {t.dashboard.articlesByCategory}
          </h2>
          <CategoryBarChart data={categoryData} />
        </section>
        <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-medium text-primary-dark">
            {t.dashboard.articlesByCrop}
          </h2>
          {cropData.length ? (
            <CropPieChart data={cropData} />
          ) : (
            <p className="text-sm text-muted">{t.dashboard.noCropData}</p>
          )}
        </section>
      </div>

      {flaggedCount > 0 && (
        <div className="flex items-center gap-3 text-sm text-muted">
          <XCircle className="size-4 text-danger" />
          <span>
            {reviewText}{" "}
            <Link
              href="/analytics"
              className="text-primary underline hover:text-primary-light"
            >
              {t.dashboard.reviewThem}
            </Link>
          </span>
        </div>
      )}
    </div>
  );
}
