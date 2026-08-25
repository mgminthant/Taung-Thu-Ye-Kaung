"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Pencil, Plus, Trash2, X } from "lucide-react";
import { Modal } from "@/components/modal";
import { useToast } from "@/components/toast";
import { useLocale } from "@/lib/locale-context";
import type { TaxonomyOption } from "@/lib/taxonomy";

/**
 * Collapsible multi-select for taxonomy labels (categories / crops).
 * Shows a closed box with the selected chips + down arrow; expands into a
 * checkbox list on click. Rows for DB-backed terms carry edit / delete icons;
 * hardcoded fallback terms (no id) are not editable. A "+" button opens a
 * modal to add a new term, persisted via /api/taxonomy.
 *
 * The add/edit modal and the delete confirmation are portaled to
 * document.body: this component lives inside the article form's <form>, and
 * both invalid HTML nesting and bubbling submit events previously made the
 * outer form fire on every label save.
 */
export type TaxonomyTermOption = TaxonomyOption & { id?: number };

export function TaxonomySelect({
  type,
  label,
  addTitle,
  options,
  selected,
  onChange,
  onOptionsChange,
  onOptionsRemove,
}: {
  type: "category" | "crop";
  label: string;
  addTitle: string;
  options: TaxonomyTermOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  /** Append a newly created term, or replace the row on an edited one. */
  onOptionsChange: (term: TaxonomyTermOption) => void;
  /** Drop a deleted term from the option list. */
  onOptionsRemove: (value: string) => void;
}) {
  const { t } = useLocale();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  // Set while the modal edits an existing term instead of creating one.
  const [editing, setEditing] = useState<TaxonomyTermOption | null>(null);
  const [saving, setSaving] = useState(false);
  const [enName, setEnName] = useState("");
  const [mmName, setMmName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TaxonomyTermOption | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const toggleValue = (value: string) =>
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value]
    );

  function openAddModal() {
    setOpen(false);
    setEditing(null);
    setEnName("");
    setMmName("");
    setAddError(null);
    setAdding(true);
  }

  function openEditModal(term: TaxonomyTermOption) {
    setOpen(false);
    setEditing(term);
    setEnName(term.en);
    setMmName(term.mm);
    setAddError(null);
    setAdding(true);
  }

  async function onSaveSubmit() {
    if (!enName.trim() && !mmName.trim()) return;
    setSaving(true);
    setAddError(null);
    try {
      const res = await fetch(
        editing ? `/api/taxonomy/${editing.id}` : "/api/taxonomy",
        {
          method: editing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, en: enName, mm: mmName }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      const term: TaxonomyTermOption = data.term ?? {
        ...editing!,
        en: enName.trim(),
        mm: mmName.trim(),
      };
      onOptionsChange(term);
      if (!editing && !selected.includes(term.value)) {
        onChange([...selected, term.value]);
      }
      setAdding(false);
      toast(editing ? t.taxonomy.updatedMsg : t.taxonomy.addedMsg, "success");
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteConfirm() {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/taxonomy/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to delete");
      }
      onOptionsRemove(deleteTarget.value);
      onChange(selected.filter((v) => v !== deleteTarget.value));
      toast(t.taxonomy.deletedMsg, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to delete", "error");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  const inputCls =
    "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none";
  const iconBtnCls =
    "rounded p-1 text-muted transition-colors hover:bg-surface-accent hover:text-primary";

  return (
    <div>
      <div className="mb-1 flex items-center gap-1">
        <label className="text-sm font-medium text-primary-dark dark:text-white">
          {label}
        </label>
        <button
          type="button"
          onClick={openAddModal}
          title={addTitle}
          className="rounded-md p-0.5 text-primary transition-colors hover:bg-surface-accent"
        >
          <Plus className="size-4" />
        </button>
      </div>

      <div ref={boxRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2 text-left text-sm transition-colors hover:border-primary focus:border-primary focus:outline-none"
        >
          {selected.length === 0 ? (
            <span className="text-muted">{t.taxonomy.selectPlaceholder}</span>
          ) : (
            <span className="flex flex-wrap gap-1">
              {selected.map((value) => {
                const o = options.find((opt) => opt.value === value);
                return (
                  <span
                    key={value}
                    className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                  >
                    {o ? `${o.mm} / ${o.en}` : value}
                    <X
                      className="size-3 cursor-pointer hover:text-danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleValue(value);
                      }}
                    />
                  </span>
                );
              })}
            </span>
          )}
          <ChevronDown
            className={`size-4 shrink-0 text-muted transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>

        {open && (
          <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-surface shadow-lg">
            {options.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted">{t.common.loading}</p>
            ) : (
              options.map((o) => {
                const active = selected.includes(o.value);
                return (
                  <div
                    key={o.value}
                    className={`flex w-full items-center px-3 py-2 text-sm transition-colors ${
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-surface-accent"
                    }`}
                  >
                    {/* Main area toggles selection; icons sit outside so the
                        row is not a button-in-button (invalid HTML). */}
                    <button
                      type="button"
                      onClick={() => toggleValue(o.value)}
                      aria-pressed={active}
                      className="flex flex-1 items-center gap-2 text-left"
                    >
                      <span
                        className={`flex size-4 shrink-0 items-center justify-center rounded border ${
                          active
                            ? "border-primary bg-primary text-white"
                            : "border-border"
                        }`}
                      >
                        ✓
                      </span>
                      {o.mm} / {o.en}
                    </button>
                    {o.id != null && (
                      <>
                        <button
                          type="button"
                          title={t.taxonomy.editTitle}
                          aria-label={t.taxonomy.editTitle}
                          onClick={() => openEditModal(o)}
                          className={iconBtnCls}
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          title={t.taxonomy.deleteTitle}
                          aria-label={t.taxonomy.deleteTitle}
                          onClick={() => {
                            setOpen(false);
                            setDeleteTarget(o);
                          }}
                          className={`${iconBtnCls} hover:text-danger`}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {typeof document !== "undefined" &&
        createPortal(
          <Modal
            open={adding}
            onClose={() => setAdding(false)}
            title={editing ? t.taxonomy.editTitle : addTitle}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSaveSubmit();
              }}
              className="space-y-4"
            >
              {addError && (
                <p className="rounded-md border border-danger/30 bg-danger-muted px-3 py-2 text-sm text-danger">
                  {addError}
                </p>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-primary-dark dark:text-white">
                  {t.taxonomy.enNameLabel}
                </label>
                <input
                  className={inputCls}
                  value={enName}
                  onChange={(e) => setEnName(e.target.value)}
                  placeholder={type === "category" ? "Weed control" : "Sunflower"}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-primary-dark dark:text-white">
                  {t.taxonomy.mmNameLabel}
                </label>
                <input
                  className={inputCls}
                  value={mmName}
                  onChange={(e) => setMmName(e.target.value)}
                  placeholder={type === "category" ? "ပေါင်းသတ်" : "နေကြာ"}
                />
              </div>
              <div className="flex items-center gap-3 border-t border-border pt-4">
                <button
                  type="submit"
                  disabled={saving || (!enName.trim() && !mmName.trim())}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-light disabled:opacity-50"
                >
                  {saving ? t.articleForm.saving : t.common.save}
                </button>
                <button
                  type="button"
                  onClick={() => setAdding(false)}
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-accent hover:text-foreground"
                >
                  {t.common.cancel}
                </button>
              </div>
            </form>
          </Modal>,
          document.body
        )}

      {typeof document !== "undefined" &&
        createPortal(
          <Modal
            open={!!deleteTarget}
            onClose={() => setDeleteTarget(null)}
            title={t.taxonomy.deleteTitle}
          >
            <p className="mb-6 text-sm text-muted">
              {t.taxonomy.deleteConfirmMsg.replace(
                "{name}",
                deleteTarget ? `${deleteTarget.mm} / ${deleteTarget.en}` : ""
              )}
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-accent hover:text-foreground"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                onClick={onDeleteConfirm}
                disabled={deleting}
                className="rounded-md bg-danger px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
              >
                {t.common.delete}
              </button>
            </div>
          </Modal>,
          document.body
        )}
    </div>
  );
}
