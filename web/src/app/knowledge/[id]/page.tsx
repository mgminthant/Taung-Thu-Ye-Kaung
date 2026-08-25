import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { ArticleForm } from "@/components/article-form";
import { getTranslations } from "@/lib/get-locale";

export const dynamic = "force-dynamic";

export default async function EditArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations();
  const { id } = await params;
  const article = await prisma.article.findUnique({ where: { id } });
  if (!article) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          href="/knowledge"
          className="mb-2 flex items-center gap-1 text-sm text-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> {t.knowledge.title}
        </Link>
        <h1 className="text-2xl font-semibold text-foreground">
          {t.common.back} <span className="font-mono text-base text-muted-light">{id}</span>
        </h1>
      </div>
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <ArticleForm article={article} />
      </div>
    </div>
  );
}
