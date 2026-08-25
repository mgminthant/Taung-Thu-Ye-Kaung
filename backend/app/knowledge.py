"""Knowledge base record model.

Articles are loaded from the portal's SQLite DB (see sqlite_loader.py) — the
CSV source was removed. Each row is a **flexible article**:

    id, title, category, crop, content, source, tags, region, language, verified

Only ``title + content`` (plus crop/categories/tags) is embedded via
``search_text``. Everything else (category, crop, tags, source, ...) is metadata
kept separately so it can be used later for filtering and analytics.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class KnowledgeRecord:
    """One article of the knowledge base.

    ``tags`` / ``categories`` / ``crops`` are lists. ``language`` is "my"
    (Myanmar) by default. ``verified`` marks human-checked content.
    """

    id: str
    title: str
    category: str
    crop: str
    content: str
    source: str
    tags: list[str]
    region: str
    language: str
    verified: bool
    # Last-write timestamp (ISO from SQLite updatedAt). Used only to detect
    # edits for incremental re-indexing; empty for CSV/legacy rows.
    updated_at: str = ""
    # All categories/crops (from the ArticleCategory / ArticleCrop relations),
    # not just the legacy single-value columns. Embedded + used for filtering.
    categories: list[str] = field(default_factory=list)
    crops: list[str] = field(default_factory=list)
    # Original (pre-canonicalization) crop labels as typed in the portal, e.g.
    # "ကြက်သွန်နီ". Kept so the embedded text still contains the Burmese words
    # farmers use, and so the agriculture gate can short-circuit on them.
    crop_raw: str = ""
    crops_raw: list[str] = field(default_factory=list)

    def search_text(self) -> str:
        """The text that gets embedded for semantic search.

        Now includes **title + content + crop(s) + categories + tags** so a
        user question that names a crop, category, or tag still matches the
        article even when the body wording differs. Raw (pre-canonicalization)
        crop labels are embedded too — the Burmese words farmers actually type
        must stay in the multilingual embedding space even though metadata
        filtering uses the canonical English value. Metadata that only drives
        filtering (and is not useful as search text) is kept out.
        """
        parts = [self.title, self.content]
        extra: list[str] = []
        if self.crop:
            extra.append(self.crop)
        extra.extend(self.crops)
        if self.crop_raw and self.crop_raw not in extra:
            extra.append(self.crop_raw)
        for raw in self.crops_raw:
            if raw and raw not in extra:
                extra.append(raw)
        extra.extend(self.categories)
        extra.extend(self.tags)
        if extra:
            parts.append(" ".join(extra))
        return ". ".join(p for p in parts if p)

    def change_signature(self) -> str:
        """Stable string reflecting every field that affects retrieval.

        Includes the embedded text AND all metadata (crop, crops, categories,
        tags, language, raw label variants) plus the last-write time. Any edit
        — to the body, a crop, a category, a tag, or even just ``updatedAt`` —
        changes this, so a re-index is always triggered and the vector store
        stays in sync with SQLite on every add/update/delete.
        """
        return "|".join(
            [
                self.id,
                self.updated_at,
                self.title,
                self.content,
                self.category,
                self.crop,
                ",".join(sorted(self.crops)),
                ",".join(sorted(self.categories)),
                ",".join(sorted(self.tags)),
                self.language,
                self.crop_raw,
                ",".join(sorted(self.crops_raw)),
            ]
        )
