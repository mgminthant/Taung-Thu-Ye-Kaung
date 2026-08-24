import { parse } from "csv-parse/sync";
import { readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/db";
import { CATEGORY_OPTIONS, CROP_OPTIONS } from "../src/lib/taxonomy";

const repoRoot = path.resolve(path.dirname(import.meta.dirname ?? process.cwd()), "..");
const csvPath = path.join(repoRoot, "data", "agriculture.csv");
const jsonlPath = path.join(repoRoot, "backend", "feedback.jsonl");

const bool = (v: unknown) => String(v).trim().toLowerCase() === "true";

/** Parse a multi-value CSV field — supports comma, semicolon, or pipe separators. */
function parseMulti(v: string | undefined): string[] {
  if (!v) return [];
  return v
    .split(/[,;|]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

async function seedArticles() {
  const rows = parse(readFileSync(csvPath, "utf8"), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  let created = 0;
  let skipped = 0;
  for (const row of rows) {
    const id = String(row.id).trim();
    if (!id) continue;
    const exists = await prisma.article.findUnique({ where: { id } });
    if (exists) {
      skipped++;
      continue; // keep admin edits; DB is the source of truth for the portal
    }

    const categories = parseMulti(row.category);
    const crops = parseMulti(row.crop);
    // Convert semicolons in tags to commas for consistent storage.
    const tags = row.tags ? String(row.tags).replace(/;/g, ",") : null;

    await prisma.article.create({
      data: {
        id,
        title: String(row.title ?? ""),
        category: categories[0] ?? "general",
        crop: crops[0] ?? null,
        content: String(row.content ?? ""),
        source: row.source ? String(row.source) : null,
        tags,
        region: row.region ? String(row.region) : null,
        language: String(row.language ?? "my"),
        verified: bool(row.verified),
        categories: categories.length
          ? { create: categories.map((c) => ({ category: c })) }
          : undefined,
        crops: crops.length
          ? { create: crops.map((c) => ({ crop: c })) }
          : undefined,
      },
    });
    created++;
  }
  console.log(`articles: ${created} created, ${skipped} already present`);
}

async function seedFeedback() {
  const lines = readFileSync(jsonlPath, "utf8").split("\n").filter(Boolean);

  // feedback.jsonl is the source of truth for seeded feedback; the portal only
  // *reviews* these rows, so truncate + re-import keeps seeding idempotent.
  const deleted = await prisma.feedback.deleteMany();
  let created = 0;
  for (const line of lines) {
    const r = JSON.parse(line);
      await prisma.feedback.create({
        data: {
          ts: new Date(r.ts),
          useful: Boolean(r.useful),
          message: String(r.message ?? ""),
          answer: String(r.answer ?? ""),
          sourceIds: JSON.stringify(r.source_ids ?? []),
          reason: r.reason ? String(r.reason) : null,
          comment: r.comment ? String(r.comment) : null,
          conversationId: r.conversation_id ? String(r.conversation_id) : null,
        },
      });
    created++;
  }
  console.log(`feedback: ${deleted.count} removed, ${created} imported`);
}

/** Seed the admin-managed taxonomy (insert-if-missing keeps admin additions). */
async function seedTaxonomy() {
  let created = 0;
  const groups = [
    { type: "category", options: CATEGORY_OPTIONS },
    { type: "crop", options: CROP_OPTIONS },
  ] as const;
  for (const { type, options } of groups) {
    for (const o of options) {
      const exists = await prisma.taxonomyTerm.findUnique({
        where: { type_value: { type, value: o.value } },
      });
      if (exists) continue;
      await prisma.taxonomyTerm.create({
        data: { type, value: o.value, en: o.en, mm: o.mm },
      });
      created++;
    }
  }
  console.log(`taxonomy: ${created} terms created`);
}

async function main() {
  await seedArticles();
  await seedFeedback();
  await seedTaxonomy();
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
