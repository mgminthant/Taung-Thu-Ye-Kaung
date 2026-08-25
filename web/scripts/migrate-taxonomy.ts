/**
 * One-time migration: canonicalize crop/category labels to the predefined
 * taxonomy (mirrors backend/app/canonical.py and web/src/lib/taxonomy.ts).
 *
 * - Article.crop / ArticleCrop.crop  -> canonical English crop values
 * - ArticleCategory.category (+ Article.category first value) -> canonical
 * - Dedupes junction rows (unique constraints) after remapping
 * - Bumps updatedAt on touched articles so the backend's quick-signature
 *   reload check notices the change and re-indexes
 *
 * Run from web/:  npx tsx scripts/migrate-taxonomy.ts
 */
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

// --- keep in sync with backend/app/canonical.py ---
const CROP_MAP: Record<string, string> = {
  corn: "maize",
  "စပါး": "rice",
  "ဆန်စပါး": "rice",
  "ပြောင်း": "maize",
  "ကြက်သွန်": "onion",
  "ကြက်သွန်နီ": "onion",
  "ကြက်သွန်ဖြူ": "garlic",
  "ခရမ်းချဉ်": "tomato",
  "ခရမ်းသီး": "eggplant",
  "ငရုတ်": "chili",
  "ငရုတ်သီး": "chili",
  "ဂေါ်ဖီ": "cabbage",
  "ပဲ": "bean",
  "အာလူး": "potato",
  "ကြံ": "sugarcane",
  "သကြားကြံ": "sugarcane",
  "မြေပဲ": "peanut",
  "ဖရဲသီး": "watermelon",
  "အထွေထွေ": "general",
};

const CATEGORY_MAP: Record<string, string> = {
  "စိုက်ပျိုးနည်း": "cultivation",
  "သီးနှံစိုက်ပျိုးခြင်း": "cultivation",
  "ရောဂါ": "disease",
  "ပိုးမွှား": "pest",
  "အင်းဆက်ပိုး": "pest",
  "မြေသြဇာ": "fertilizer",
  "မြေဩဇာ": "soil_management",
  "ရေစီမံခန့်ခွဲမှု": "water_management",
  "ရောဂါကာကွယ်နှိမ်နင်းခြင်း": "prevention",
  "ကာကွယ်ရေး": "prevention",
  "ရိတ်သိမ်းခြင်း": "harvesting",
  "စိုက်ပျိုးပြီးစီမံခန့်ခွဲမှု": "post_harvest",
  "မျိုးစေ့ရွေးချယ်ရေး": "seed_selection",
  "အာဟာရ": "nutrition",
  "ကျန်းမာရေးအကျိုးကျေးဇူး": "health_benefits",
  "အထွေထွေ": "general",
};

const canonical = (map: Record<string, string>, label: string): string => {
  const raw = (label ?? "").trim().toLowerCase();
  if (!raw) return "";
  if (raw in map) return map[raw];
  return raw; // English labels are already canonical
};

const db = new Database("dev.db");
db.pragma("journal_mode = WAL");

const changedArticles = new Set<string>();
let cropCells = 0;
let catRowsUpdated = 0;
let catRowsRemoved = 0;
let cropRowsUpdated = 0;
let cropRowsRemoved = 0;

const now = () => new Date().toISOString().replace("Z", "+00:00");

// --- 1. Article.crop (legacy single column) ---
for (const row of db.prepare("SELECT id, crop FROM Article WHERE crop IS NOT NULL AND crop != ''").all() as { id: string; crop: string }[]) {
  const next = canonical(CROP_MAP, row.crop);
  if (next && next !== row.crop) {
    db.prepare("UPDATE Article SET crop = ?, updatedAt = ? WHERE id = ?").run(next, now(), row.id);
    changedArticles.add(row.id);
    cropCells++;
  }
}

// --- 2. ArticleCategory rows ---
type CatRow = { id: number; articleId: string; category: string };
const catRows = db.prepare("SELECT id, articleId, category FROM ArticleCategory").all() as CatRow[];
for (const row of catRows) {
  const next = canonical(CATEGORY_MAP, row.category);
  if (!next || next === row.category) continue;
  const dup = db
    .prepare("SELECT id FROM ArticleCategory WHERE articleId = ? AND category = ? AND id != ?")
    .get(row.articleId, next, row.id);
  if (dup) {
    db.prepare("DELETE FROM ArticleCategory WHERE id = ?").run(row.id);
    catRowsRemoved++;
  } else {
    db.prepare("UPDATE ArticleCategory SET category = ? WHERE id = ?").run(next, row.id);
    catRowsUpdated++;
  }
  changedArticles.add(row.articleId);
}

// --- 3. ArticleCrop rows ---
type CropRow = { id: number; articleId: string; crop: string };
const cropRelRows = db.prepare("SELECT id, articleId, crop FROM ArticleCrop").all() as CropRow[];
for (const row of cropRelRows) {
  const next = canonical(CROP_MAP, row.crop);
  if (!next || next === row.crop) continue;
  const dup = db
    .prepare("SELECT id FROM ArticleCrop WHERE articleId = ? AND crop = ? AND id != ?")
    .get(row.articleId, next, row.id);
  if (dup) {
    db.prepare("DELETE FROM ArticleCrop WHERE id = ?").run(row.id);
    cropRowsRemoved++;
  } else {
    db.prepare("UPDATE ArticleCrop SET crop = ? WHERE id = ?").run(next, row.id);
    cropRowsUpdated++;
  }
  changedArticles.add(row.articleId);
}

// --- 4. Article.category (first canonical category) + updatedAt bump ---
for (const articleId of changedArticles) {
  const first = db
    .prepare("SELECT category FROM ArticleCategory WHERE articleId = ? ORDER BY id LIMIT 1")
    .get(articleId) as { category: string } | undefined;
  if (first) {
    db.prepare("UPDATE Article SET category = ?, updatedAt = ? WHERE id = ?").run(
      first.category,
      now(),
      articleId
    );
  } else {
    // Only junction-free articles keep their earlier bump; make sure every
    // touched article's timestamp actually moved so sync detects it.
    db.prepare("UPDATE Article SET updatedAt = ? WHERE id = ?").run(now(), articleId);
  }
}

console.log(
  JSON.stringify(
    {
      migration_id: randomUUID(),
      article_crop_cells_updated: cropCells,
      category_rows_updated: catRowsUpdated,
      duplicate_category_rows_removed: catRowsRemoved,
      crop_rows_updated: cropRowsUpdated,
      duplicate_crop_rows_removed: cropRowsRemoved,
      articles_touched: changedArticles.size,
    },
    null,
    2
  )
);

db.close();
