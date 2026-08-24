"""Canonical label normalization for crops and categories.

The portal lets admins type any crop/category label (and the AI-suggester
invents labels freely, in Burmese or English depending on the form locale),
so the database accumulates many spellings for the same concept:

    onion / ကြက်သွန်နီ / ကြက်သွန်        maize / corn / ပြောင်း
    cultivation / စိုက်ပျိုးနည်း          soil_management / မြေဩဇာ

Retrieval filters on crop metadata by EXACT match, so mixed labels hide
articles from the mobile bot. Every label loaded from SQLite is therefore
normalized to one canonical lowercase English value here, before it reaches
the vector store. Canonical English was chosen because the intent+NER stage
already tends to return English crop names, most seeded articles are English,
and analytics labels follow the same convention.

Labels missing from the static map (brand-new crops) are kept AS-IS rather
than LLM-translated — a wrong one-shot guess would be silently cached and
misroute retrieval. Instead, the intent+NER stage is grounded on the full KB
label list (canonical + raw), so it echoes whichever label the KB actually
uses and the exact-match filter hits deterministically.
"""
from __future__ import annotations

# ---------------------------------------------------------------------------
# Static variant -> canonical maps. Keep web/src/lib/taxonomy.ts in sync.
# ---------------------------------------------------------------------------

CANONICAL_CROPS: dict[str, str] = {
    # English aliases
    "corn": "maize",
    # Burmese names (CROP_MYANMAR_HINTS reversed + portal-created variants)
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
}

CANONICAL_CATEGORIES: dict[str, str] = {
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
}

# Predefined category taxonomy shown in the portal and enforced in the
# classifier prompt (values must stay lowercase snake_case English).
CATEGORY_TAXONOMY: tuple[str, ...] = (
    "cultivation",
    "disease",
    "pest",
    "fertilizer",
    "soil_management",
    "water_management",
    "prevention",
    "harvesting",
    "post_harvest",
    "seed_selection",
    "nutrition",
    "health_benefits",
    "general",
)


def canonical_crop(label: str) -> str:
    """Canonical lowercase English crop name for ``label`` (never empty).

    Order: trim/lowercase → empty fallback → static map (covers both Burmese
    names and English aliases like "corn"->"maize") → raw label passthrough.
    Unknown labels are intentionally kept as-is; the NER stage is grounded on
    the KB's label list so it echoes them back for exact-match filtering.
    """
    raw = (label or "").strip().lower()
    if not raw:
        return "general"
    return CANONICAL_CROPS.get(raw, raw)


def canonical_crops(labels: list[str]) -> list[str]:
    """Canonicalize a list of crop labels, deduplicated, order preserved."""
    seen: dict[str, None] = {}
    for label in labels:
        c = canonical_crop(label)
        if c:
            seen.setdefault(c, None)
    return list(seen)


def canonical_category(label: str) -> str:
    """Canonical category value for ``label`` (static map only — no LLM)."""
    raw = (label or "").strip().lower()
    if not raw:
        return "general"
    if raw.isascii():
        return raw
    return CANONICAL_CATEGORIES.get(raw, raw)
