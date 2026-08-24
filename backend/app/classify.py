"""LLM-based article classification: auto-suggest categories, crops, and tags.

Uses gpt-4o-mini to analyze article title + content and return structured
suggestions that the admin portal can present for user review.
"""
from __future__ import annotations

import json
from typing import Any

import httpx

from .canonical import CATEGORY_TAXONOMY
from .config import settings

CLASSIFY_SYSTEM_PROMPT_EN = """You are a classifier for တောင်သူ့ရဲ့ခေါင်, a Myanmar agricultural knowledge base.

Given an article's title and content, classify it and extract relevant tags.

OUTPUT: Return ONLY a JSON object with these keys:
- categories: array of 1-3 relevant category labels (lowercase, snake_case if multi-word)
- crops: array of 1-3 relevant crop names (lowercase English, e.g. "rice", "tomato"); use "general" if not crop-specific
- tags: array of 3-8 relevant English keywords (lowercase, e.g. "nitrogen deficiency", "leaf yellowing")

RULES:
1. Categories MUST be chosen ONLY from this predefined list: {categories}.
2. Pick the category that best matches what the article teaches (how-to -> cultivation; problem identification -> disease/pest; treatment/control advice -> prevention; nutrients or soil amendments -> fertilizer/soil_management).
3. Predict crops freely — any crop name in English.
4. Tags should be specific English keywords useful for search.
5. Return ONLY the JSON object. No markdown, no comments."""

CLASSIFY_SYSTEM_PROMPT_MY = """You are a classifier for တောင်သူ့ရဲ့ခေါင်, a Myanmar agricultural knowledge base.

Given an article's title and content (in Myanmar/Burmese), classify it and extract relevant tags. Respond entirely in the Myanmar (Burmese) language.

OUTPUT: Return ONLY a JSON object with these keys:
- categories: array of 1-3 relevant category labels in Burmese (e.g. "ရောဂါ", "မျိုးစေ့", "မြေဩဇာ")
- crops: array of 1-3 relevant crop names in Burmese (e.g. "ဆန်စပါး", "ခရမ်းချဉ်"); use "အထွေထွေ" if not crop-specific
- tags: array of 3-8 relevant Burmese keywords useful for search (e.g. "အစိမ်းရောင်ချို့ယွင်းခြင်း", "ရွက်ဝါခြင်း")

RULES:
1. Category labels MUST be Burmese equivalents of ONLY these predefined values: {categories}.
2. Pick the category that best matches what the article teaches.
3. Predict crops freely — any crop name in Burmese.
4. Tags should be specific Burmese keywords useful for search.
5. Separate values with commas (",") within each array.
6. Return ONLY the JSON object. No markdown, no comments."""


def _extract_json_object(text: str) -> dict[str, Any]:
    """Pull the first balanced {...} block out of an LLM response."""
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError(f"No JSON object in response: {text[:200]!r}")
    try:
        return json.loads(text[start : end + 1])
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON in response: {text[start:end+1][:200]!r}") from exc


def _openrouter_headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/taung-thu-ye-khaung",
        "X-Title": settings.app_name,
    }


async def classify_article(
    title: str, content: str, language: str = "en"
) -> dict[str, list[str]]:
    """Use LLM to suggest categories, crops, and tags for an article.

    Returns {"categories": [...], "crops": [...], "tags": [...]}.
    AI predicts freely — no predefined lists enforced. When ``language`` is
    "my" the suggestions are returned in Burmese.
    """
    if not settings.openrouter_api_key:
        raise RuntimeError("OPENROUTER_API_KEY is not configured")

    system_prompt = (
        (CLASSIFY_SYSTEM_PROMPT_MY if language == "my" else CLASSIFY_SYSTEM_PROMPT_EN)
        .replace("{categories}", ", ".join(CATEGORY_TAXONOMY))
    )

    user_block = f"TITLE:\n{title}\n\nCONTENT:\n{content[:2000]}"

    payload: dict[str, Any] = {
        "model": settings.openrouter_model,
        "temperature": 0.0,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_block},
        ],
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{settings.openrouter_base_url.rstrip('/')}/chat/completions",
            headers=_openrouter_headers(),
            json=payload,
        )
        response.raise_for_status()
        data = response.json()

    try:
        content_str = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError(f"Unexpected OpenRouter response: {json.dumps(data)[:500]}") from exc

    raw = _extract_json_object(str(content_str))

    # Clean: lowercase, strip, deduplicate. Categories are snapped onto the
    # predefined taxonomy (the prompt constrains them, but models drift);
    # unknown labels are dropped rather than inventing new ones.
    def _snap_category(label: str) -> str | None:
        from .canonical import CANONICAL_CATEGORIES

        c = str(label).strip().lower()
        c = CANONICAL_CATEGORIES.get(c, c)
        return c if c in CATEGORY_TAXONOMY else None

    categories = list(dict.fromkeys(
        c for c in (_snap_category(v) for v in raw.get("categories", []) if v)
        if c
    ))[:3]
    crops = list(dict.fromkeys(
        str(c).strip().lower() for c in raw.get("crops", []) if c
    ))[:3]
    tags = list(dict.fromkeys(
        str(t).strip().lower() for t in raw.get("tags", []) if t
    ))[:8]

    # Ensure at least one category and crop.
    if not categories:
        categories = ["general"]
    if not crops:
        crops = ["general"]

    return {"categories": categories, "crops": crops, "tags": tags}
