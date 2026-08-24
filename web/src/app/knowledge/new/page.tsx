import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ArticleForm } from "@/components/article-form";
import { getTranslations } from "@/lib/get-locale";

export default async function NewArticlePage() {
  const t = await getTranslations();
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          href="/knowledge"
          className="mb-2 flex items-center gap-1 text-sm text-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> {t.knowledge.title}
        </Link>
        <h1 className="text-2xl font-semibold text-foreground">{t.knowledge.newArticle}</h1>
      </div>
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <ArticleForm />
      </div>
    </div>
  );
}
