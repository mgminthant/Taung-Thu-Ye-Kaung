"""Knowledge base: loads data/agriculture.csv into records.

The CSV is the single source of truth for farming facts. Following the PRD
(section 12/13), each row is a **flexible article**:

    id, title, category, crop, content, source, tags, region, language, verified

Only ``title + content`` is embedded (``search_text``). Everything else
(category, crop, tags, source, ...) is metadata kept separately so it can be
used later for filtering and analytics.
"""
from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path


@dataclass
class KnowledgeRecord:
    """One article of the knowledge CSV.

    ``tags`` is the ``;``-separated cell split into a list. ``language`` is
    "my" (Myanmar) by default. ``verified`` marks human-checked content.
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

    def search_text(self) -> str:
        """The text that gets embedded: **Title + Content** only.

        Metadata (category, crop, tags...) is deliberately NOT embedded — the
        PRD says embedding should stay focused on the article text so semantic
        search compares meaning, while metadata stays available for filtering.
        """
        return f"{self.title}. {self.content}"


def _split_list(value: str) -> list[str]:
    """Parse a `;`-separated CSV cell into a clean list of strings."""
    if not value:
        return []
    return [part.strip() for part in value.split(";") if part.strip()]


def load_knowledge(csv_path: str | Path) -> list[KnowledgeRecord]:
    """Read the CSV file and return one KnowledgeRecord per data row."""
    path = Path(csv_path)
    if not path.exists():
        raise FileNotFoundError(f"Knowledge CSV not found: {path}")

    records: list[KnowledgeRecord] = []
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            records.append(
                KnowledgeRecord(
                    id=row.get("id", "").strip(),
                    title=row.get("title", "").strip(),
                    category=row.get("category", "general_information").strip(),
                    crop=row.get("crop", "").strip(),
                    content=row.get("content", "").strip(),
                    source=row.get("source", "").strip(),
                    tags=_split_list(row.get("tags", "")),
                    region=row.get("region", "").strip(),
                    language=row.get("language", "my").strip(),
                    verified=str(row.get("verified", "")).lower() == "true",
                )
            )
    return records
