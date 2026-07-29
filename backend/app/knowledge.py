from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path


@dataclass
class KnowledgeRecord:
    id: str
    crop: str
    topic: str
    symptoms: list[str]
    possible_causes: list[str]
    solution: str
    region: str
    source: str
    language: str
    verified: bool
    question: str
    answer: str

    def search_text(self) -> str:
        parts = [
            self.crop,
            self.topic,
            self.question,
            self.answer,
            self.solution,
            " ".join(self.symptoms),
            " ".join(self.possible_causes),
        ]
        return " ".join(parts).lower()


def _split_list(value: str) -> list[str]:
    if not value:
        return []
    return [part.strip() for part in value.split(";") if part.strip()]


def load_knowledge(csv_path: str | Path) -> list[KnowledgeRecord]:
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
                    crop=row.get("crop", "").strip(),
                    topic=row.get("topic", "").strip(),
                    symptoms=_split_list(row.get("symptoms", "")),
                    possible_causes=_split_list(row.get("possible_causes", "")),
                    solution=row.get("solution", "").strip(),
                    region=row.get("region", "").strip(),
                    source=row.get("source", "").strip(),
                    language=row.get("language", "en").strip(),
                    verified=str(row.get("verified", "")).lower() == "true",
                    question=row.get("question", "").strip(),
                    answer=row.get("answer", "").strip(),
                )
            )
    return records
