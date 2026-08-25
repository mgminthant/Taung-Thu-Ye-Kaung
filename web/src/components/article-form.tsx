"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/locale-context";
import { useToast } from "@/components/toast";
import {
  TaxonomySelect,
  type TaxonomyTermOption,
} from "@/components/taxonomy-select";
import {
  CATEGORY_OPTIONS,
  CROP_OPTIONS,
} from "@/lib/taxonomy";

type ArticleWithRelations = {
  id: string;
  title: string;
  category: string;
  crop: string | null;
  content: string;
  source: string | null;
  tags: string | null;
  region: string | null;
  language: string;
  categories?: { category: string }[];
  crops?: { crop: string }[];
};

/** Build a URL/db-safe slug from a (possibly Burmese) title. */
function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 80);
}

function toList(
  arr: { category: string }[] | { crop: string }[] | undefined,
  key: string,
  legacy: string | null | undefined
): string[] {
  const values = arr?.length
    ? arr.map((item) => (item as Record<string, string>)[key])
    : legacy
      ? [legacy]
      : [];
  return [...new Set(values.filter(Boolean))];
}

/** Ensure stored labels that are no longer known terms stay selectable. */
function withStoredExtras(options: TaxonomyTermOption[], stored: string[]) {
  return [
    ...options,
    ...stored
      .filter((v) => !options.some((o) => o.value === v))
      .map((v) => ({ value: v, en: v, mm: v })),
  ];
}

export function ArticleForm({
  article,
  onSuccess,
  onCancel,
}: {
  article?: ArticleWithRelations;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const { t } = useLocale();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const storedCategories = toList(
    article?.categories,
    "category",
    article?.category
  );
  const storedCrops = toList(article?.crops, "crop", article?.crop);

  const [form, setForm] = useState({
    id: article?.id ?? "",
    title: article?.title ?? "",
    content: article?.content ?? "",
    source: article?.source ?? "",
    tags: article?.tags ?? "",
    region: article?.region ?? "",
    language: article?.language ?? "my",
  });

  // Options come from the DB (admin-managed via the "+" button); hardcoded
  // taxonomy is only a pre-fetch fallback. Stored-but-unknown labels are kept
  // selectable so editing never silently drops data.
  const [categoryOptions, setCategoryOptions] = useState<TaxonomyTermOption[]>(
    () => withStoredExtras(CATEGORY_OPTIONS, storedCategories)
  );
  const [cropOptions, setCropOptions] = useState<TaxonomyTermOption[]>(() =>
    withStoredExtras(CROP_OPTIONS, storedCrops)
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/taxonomy")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !Array.isArray(data.items)) return;
        // id is kept on each option so the dropdown can offer edit/delete.
        const toOption = (
          i: Record<string, string | number>
        ): TaxonomyTermOption => ({
          value: String(i.value),
          en: String(i.en),
          mm: String(i.mm),
          id: Number(i.id),
        });
        const dbCategories = data.items
          .filter((i: Record<string, string | number>) => i.type === "category")
          .map(toOption);
        const dbCrops = data.items
          .filter((i: Record<string, string | number>) => i.type === "crop")
          .map(toOption);
        // Merge instead of replace. DB terms come FIRST so their ids survive
        // deduplication (fallback constants share the same values but carry no
        // id, and the edit/delete icons only render for id-backed terms).
        // Anything already in state — labels added via "+" while this fetch
        // was in flight — is never wiped; hardcoded leftovers go last.
        const merge = (...groups: TaxonomyTermOption[][]) => {
          const seen = new Set<string>();
          const merged: TaxonomyTermOption[] = [];
          for (const group of groups) {
            for (const o of group) {
              if (!seen.has(o.value)) {
                seen.add(o.value);
                merged.push(o);
              }
            }
          }
          return merged;
        };
        setCategoryOptions((prev) => merge(dbCategories, prev, CATEGORY_OPTIONS));
        setCropOptions((prev) => merge(dbCrops, prev, CROP_OPTIONS));
      })
      .catch(() => {
        // keep fallback lists
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const [selectedCategories, setSelectedCategories] =
    useState<string[]>(storedCategories);
  const [selectedCrops, setSelectedCrops] = useState<string[]>(storedCrops);

  const set = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        // ID is auto-generated from the title (hidden field in the UI).
        id: article ? article.id : form.id || slugify(form.title),
        categories: selectedCategories,
        crops: selectedCrops,
      };
      const res = await fetch(
        article ? `/api/knowledge/${article.id}` : "/api/knowledge",
        {
          method: article ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save article");
      }
      const data = await res.json().catch(() => ({}));
      if (data.syncWarning) {
        toast(`Saved (backend sync failed: ${data.syncWarning})`, "error");
      } else {
        toast(article ? t.knowledge.updatedMsg : t.knowledge.created, "success");
      }
      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/knowledge");
        router.refresh();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save article";
      setError(msg);
      setSaving(false);
    }
  }

  const inputCls =
    "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none";
  const labelCls = "mb-1 block text-sm font-medium text-primary-dark dark:text-white";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <p className="rounded-md border border-danger/30 bg-danger-muted px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <div>
        <label className={labelCls}>{t.articleForm.titleLabel}</label>
        <input
          className={inputCls}
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          required
        />
      </div>

      <TaxonomySelect
        type="category"
        label={t.articleForm.categoriesLabel}
        addTitle={t.taxonomy.addCategory}
        options={categoryOptions}
        selected={selectedCategories}
        onChange={setSelectedCategories}
        onOptionsChange={(term) =>
          // New term → append; edited term (same value) → replace in place so
          // the chip and dropdown row immediately show the new names.
          setCategoryOptions((prev) => {
            const idx = prev.findIndex((o) => o.value === term.value);
            if (idx === -1) return [...prev, term];
            const next = [...prev];
            next[idx] = term;
            return next;
          })
        }
        onOptionsRemove={(value) =>
          setCategoryOptions((prev) => prev.filter((o) => o.value !== value))
        }
      />

      <TaxonomySelect
        type="crop"
        label={t.articleForm.cropsLabel}
        addTitle={t.taxonomy.addCrop}
        options={cropOptions}
        selected={selectedCrops}
        onChange={setSelectedCrops}
        onOptionsChange={(term) =>
          setCropOptions((prev) => {
            const idx = prev.findIndex((o) => o.value === term.value);
            if (idx === -1) return [...prev, term];
            const next = [...prev];
            next[idx] = term;
            return next;
          })
        }
        onOptionsRemove={(value) =>
          setCropOptions((prev) => prev.filter((o) => o.value !== value))
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className={labelCls}>{t.articleForm.languageLabel}</label>
          <select
            className={inputCls}
            value={form.language}
            onChange={(e) => set("language", e.target.value)}
          >
            <option value="my">my</option>
            <option value="en">en</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>{t.articleForm.sourceLabel}</label>
          <input
            className={inputCls}
            value={form.source}
            onChange={(e) => set("source", e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>{t.articleForm.regionLabel}</label>
          <input
            className={inputCls}
            value={form.region}
            onChange={(e) => set("region", e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>{t.articleForm.contentLabel}</label>
        <textarea
          className={`${inputCls} min-h-48 font-mono text-xs`}
          value={form.content}
          onChange={(e) => set("content", e.target.value)}
          required
        />
      </div>

      <div>
        <label className={labelCls}>{t.articleForm.tagsLabel}</label>
        <input
          className={inputCls}
          value={form.tags}
          onChange={(e) => set("tags", e.target.value)}
          placeholder={t.articleForm.tagsPlaceholder}
        />
      </div>

      <div className="flex items-center gap-3 border-t border-border pt-4">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-light disabled:opacity-50"
        >
          {saving ? t.articleForm.saving : article ? t.articleForm.save : t.articleForm.create}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-accent hover:text-foreground"
          >
            {t.common.cancel}
          </button>
        )}
      </div>
    </form>
  );
}
