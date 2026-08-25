"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/components/toast";
import { Modal } from "@/components/modal";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ArticleForm } from "@/components/article-form";

type Article = {
  id: string;
  title: string;
  content: string;
  language: string;
  updatedAt: string;
  categories: { category: string }[];
  crops: { crop: string }[];
};

type Props = {
  articles: Article[];
  total: number;
  page: number;
  q: string;
  category: string;
  crop: string;
  allCategories: string[];
  allCrops: string[];
  /** Pre-selected article from ?edit= (feedback review deep link). */
  editArticle?: Article;
  /** Open the "new article" modal on mount (?add=1 deep link). */
  openAdd?: boolean;
  pageLabel: string;
  totalLabel: string;
  filteredLabel: string;
  noArticles: string;
  titleCol: string;
  categoriesLabel: string;
  cropsLabel: string;
  languageLabel: string;
  updatedLabel: string;
  newArticleLabel: string;
  searchPlaceholder: string;
  allCategoriesLabel: string;
  allCropsLabel: string;
  filterLabel: string;
  createdMsg: string;
  updatedMsg: string;
  deletedMsg: string;
  deleteFailedMsg: string;
  confirmTitle: string;
  confirmDeleteMsg: string;
  editTitle: string;
  addTitle: string;
  actionsLabel: string;
};

export function KnowledgeContent({
  articles,
  total,
  page,
  q,
  category,
  crop,
  allCategories,
  allCrops,
  editArticle: initialEditArticle,
  openAdd: initialAddOpen,
  pageLabel,
  totalLabel,
  filteredLabel,
  noArticles,
  titleCol,
  categoriesLabel,
  cropsLabel,
  languageLabel,
  updatedLabel,
  newArticleLabel,
  searchPlaceholder,
  allCategoriesLabel,
  allCropsLabel,
  filterLabel,
  createdMsg,
  updatedMsg,
  deletedMsg,
  deleteFailedMsg,
  confirmTitle,
  confirmDeleteMsg,
  editTitle,
  addTitle,
  actionsLabel,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [addOpen, setAddOpen] = useState(initialAddOpen ?? false);
  const [editArticle, setEditArticle] = useState<Article | null>(
    initialEditArticle ?? null,
  );
  const [deleteTarget, setDeleteTarget] = useState<Article | null>(null);

  // Drop deep-link params (?edit=/?add=1) so refreshing doesn't re-open modals.
  function clearDeepLinkParams() {
    const sp = new URLSearchParams(searchParams.toString());
    if (!sp.has("edit") && !sp.has("add")) return;
    sp.delete("edit");
    sp.delete("add");
    router.replace(sp.size ? `?${sp.toString()}` : "?", { scroll: false });
  }

  const perPage = 20;
  const totalPages = Math.ceil(total / perPage);

  async function handleDelete() {
    if (!deleteTarget) return;
    const res = await fetch(`/api/knowledge/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.syncWarning) {
        toast(`Deleted (backend sync failed: ${data.syncWarning})`, "error");
      } else {
        toast(deletedMsg, "success");
      }
      router.refresh();
    } else {
      toast(deleteFailedMsg, "error");
    }
  }

  function pageUrl(p: number) {
    const sp = new URLSearchParams(searchParams.toString());
    if (p > 1) sp.set("page", String(p));
    else sp.delete("page");
    return `?${sp.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{pageLabel}</h1>
          <p className="text-sm text-muted">
            {totalLabel.replace("{count}", String(total))}
            {(q || category || crop) ? ` ${filteredLabel}` : ""}
          </p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-light"
        >
          <Plus className="size-4" /> {newArticleLabel}
        </button>
      </div>

      {/* Client-side filter: intercept submit so the page never reloads;
          filters are applied by pushing new search params (resets to page 1). */}
      <form
        method="GET"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          const sp = new URLSearchParams();
          const qv = String(data.get("q") ?? "").trim();
          const cat = String(data.get("category") ?? "");
          const crp = String(data.get("crop") ?? "");
          if (qv) sp.set("q", qv);
          if (cat) sp.set("category", cat);
          if (crp) sp.set("crop", crp);
          router.push(sp.size ? `?${sp.toString()}` : "?", { scroll: false });
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <input
          name="q"
          defaultValue={q}
          placeholder={searchPlaceholder}
          className="w-72 rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
        <select
          name="category"
          defaultValue={category}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
        >
          <option value="">{allCategoriesLabel}</option>
          {allCategories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          name="crop"
          defaultValue={crop}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
        >
          <option value="">{allCropsLabel}</option>
          {allCrops.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md bg-primary-dark px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary"
        >
          {filterLabel}
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-surface-accent text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3">{titleCol}</th>
              <th className="px-4 py-3">{categoriesLabel}</th>
              <th className="px-4 py-3">{cropsLabel}</th>
              <th className="px-4 py-3">{languageLabel}</th>
              <th className="px-4 py-3">{updatedLabel}</th>
              <th className="px-4 py-3 text-right">{actionsLabel}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light">
            {articles.map((a) => (
              <tr key={a.id} className="hover:bg-background">
                <td className="max-w-72 px-4 py-3">
                  <span className="font-medium text-foreground">{a.title}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {a.categories.map((ac) => (
                      <span key={ac.category} className="rounded-full bg-surface-accent px-2 py-0.5 text-xs text-primary">
                        {ac.category}
                      </span>
                    ))}
                    {a.categories.length === 0 && (
                      <span className="text-xs text-muted-light">—</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {a.crops.map((ac) => (
                      <span key={ac.crop} className="rounded-full bg-warning-muted px-2 py-0.5 text-xs text-warning">
                        {ac.crop}
                      </span>
                    ))}
                    {a.crops.length === 0 && (
                      <span className="text-xs text-muted-light">—</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">{a.language}</td>
                <td className="px-4 py-3 text-xs text-muted-light">
                  {new Date(a.updatedAt).toISOString().slice(0, 10)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => setEditArticle(a)}
                      className="rounded-md p-1.5 text-muted transition-colors hover:bg-surface-accent hover:text-primary"
                      title={editTitle}
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(a)}
                      className="rounded-md p-1.5 text-muted transition-colors hover:bg-danger-muted hover:text-danger"
                      title={confirmTitle}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {articles.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-muted">{noArticles}</p>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Link
            href={pageUrl(page - 1)}
            prefetch={false}
            className={`flex size-8 items-center justify-center rounded-md border border-border text-muted transition-colors hover:bg-surface-accent ${
              page <= 1 ? "pointer-events-none opacity-40" : ""
            }`}
          >
            <ChevronLeft className="size-4" />
          </Link>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
            .reduce<(number | "...")[]>((acc, p, i, arr) => {
              if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("...");
              acc.push(p);
              return acc;
            }, [])
            .map((p, i) =>
              p === "..." ? (
                <span key={`dots-${i}`} className="px-1 text-muted">…</span>
              ) : (
                <Link
                  key={p}
                  href={pageUrl(p)}
                  prefetch={false}
                  className={`flex size-8 items-center justify-center rounded-md border text-sm font-medium transition-colors ${
                    p === page
                      ? "border-primary bg-primary text-white"
                      : "border-border text-muted hover:bg-surface-accent"
                  }`}
                >
                  {p}
                </Link>
              )
            )}
          <Link
            href={pageUrl(page + 1)}
            prefetch={false}
            className={`flex size-8 items-center justify-center rounded-md border border-border text-muted transition-colors hover:bg-surface-accent ${
              page >= totalPages ? "pointer-events-none opacity-40" : ""
            }`}
          >
            <ChevronRight className="size-4" />
          </Link>
        </div>
      )}

      <Modal
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
          clearDeepLinkParams();
        }}
        title={addTitle}
      >
        <ArticleForm
          onSuccess={() => {
            toast(createdMsg, "success");
            setAddOpen(false);
            clearDeepLinkParams();
            router.refresh();
          }}
          onCancel={() => {
            setAddOpen(false);
            clearDeepLinkParams();
          }}
        />
      </Modal>

      <Modal
        open={!!editArticle}
        onClose={() => {
          setEditArticle(null);
          clearDeepLinkParams();
        }}
        title={editTitle}
      >
        {editArticle && (
          <ArticleForm
            article={editArticle as never}
            onSuccess={() => {
              toast(updatedMsg, "success");
              setEditArticle(null);
              clearDeepLinkParams();
              router.refresh();
            }}
            onCancel={() => {
              setEditArticle(null);
              clearDeepLinkParams();
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        title={confirmTitle}
        message={confirmDeleteMsg.replace("{title}", deleteTarget?.title ?? "")}
      />
    </div>
  );
}
