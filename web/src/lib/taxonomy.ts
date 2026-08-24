/**
 * Predefined bilingual taxonomy for article creation.
 *
 * Values are the canonical lowercase English labels the backend stores and
 * filters on; `en` / `mm` are display names. KEEP IN SYNC with the static
 * maps in backend/app/canonical.py — both sides must agree on canonical
 * values so the mobile bot's crop filter always matches.
 *
 * These constants are only a pre-fetch fallback for the article form; the
 * live list is admin-managed in the TaxonomyTerm table (see /api/taxonomy).
 */

export type TaxonomyOption = { value: string; en: string; mm: string };

export const CATEGORY_OPTIONS: TaxonomyOption[] = [
  { value: "cultivation", en: "Cultivation", mm: "စိုက်ပျိုးနည်း" },
  { value: "disease", en: "Disease", mm: "ရောဂါ" },
  { value: "pest", en: "Pest", mm: "ပိုးမွှား" },
  { value: "fertilizer", en: "Fertilizer", mm: "မြေသြဇာ" },
  { value: "soil_management", en: "Soil management", mm: "မြေဩဇာ" },
  { value: "water_management", en: "Water management", mm: "ရေစီမံခန့်ခွဲမှု" },
  { value: "prevention", en: "Prevention", mm: "ကာကွယ်နှိမ်နင်းရေး" },
  { value: "harvesting", en: "Harvesting", mm: "ရိတ်သိမ်းခြင်း" },
  { value: "post_harvest", en: "Post-harvest", mm: "စိုက်ပျိုးပြီးစီမံ" },
  { value: "seed_selection", en: "Seed selection", mm: "မျိုးစေ့ရွေးချယ်ရေး" },
  { value: "nutrition", en: "Nutrition", mm: "အာဟာရ" },
  { value: "health_benefits", en: "Health benefits", mm: "ကျန်းမာရေးအကျိုးကျေးဇူး" },
  { value: "general", en: "General", mm: "အထွေထွေ" },
];

export const CROP_OPTIONS: TaxonomyOption[] = [
  { value: "rice", en: "Rice", mm: "စပါး" },
  { value: "maize", en: "Maize", mm: "ပြောင်း" },
  { value: "onion", en: "Onion", mm: "ကြက်သွန်နီ" },
  { value: "garlic", en: "Garlic", mm: "ကြက်သွန်ဖြူ" },
  { value: "tomato", en: "Tomato", mm: "ခရမ်းချဉ်" },
  { value: "chili", en: "Chili", mm: "ငရုတ်" },
  { value: "eggplant", en: "Eggplant", mm: "ခရမ်းသီး" },
  { value: "cabbage", en: "Cabbage", mm: "ဂေါ်ဖီ" },
  { value: "bean", en: "Bean", mm: "ပဲ" },
  { value: "potato", en: "Potato", mm: "အာလူး" },
  { value: "peanut", en: "Peanut", mm: "မြေပဲ" },
  { value: "sugarcane", en: "Sugarcane", mm: "သကြားကြံ" },
  { value: "watermelon", en: "Watermelon", mm: "ဖရဲသီး" },
  { value: "general", en: "General", mm: "အထွေထွေ" },
];
