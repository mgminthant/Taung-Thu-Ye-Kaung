from __future__ import annotations

import re
from dataclasses import dataclass

from .knowledge import KnowledgeRecord

TOKEN_RE = re.compile(r"[a-z0-9]+")

STOPWORDS = {
    "a",
    "an",
    "the",
    "is",
    "are",
    "was",
    "were",
    "my",
    "me",
    "i",
    "to",
    "of",
    "in",
    "on",
    "for",
    "and",
    "or",
    "what",
    "why",
    "how",
    "do",
    "does",
    "did",
    "can",
    "could",
    "should",
    "with",
    "about",
    "it",
    "this",
    "that",
    "be",
    "been",
    "have",
    "has",
    "had",
    "please",
    "help",
}


FARMING_HINTS = {
    "rice",
    "paddy",
    "tomato",
    "chili",
    "chilli",
    "cabbage",
    "eggplant",
    "onion",
    "maize",
    "corn",
    "bean",
    "crop",
    "plant",
    "leaf",
    "leaves",
    "pest",
    "insect",
    "disease",
    "fungus",
    "fertilizer",
    "fertiliser",
    "nitrogen",
    "water",
    "watering",
    "soil",
    "seedling",
    "mulch",
    "compost",
    "farm",
    "farming",
    "yellow",
    "spot",
    "spots",
    "wilt",
    "borer",
    "aphid",
    "harvest",
}


INTENT_KEYWORDS: dict[str, set[str]] = {
    "plant_disease": {"disease", "blight", "rust", "spot", "spots", "rot", "fungus", "curl", "blast"},
    "pest": {"pest", "insect", "borer", "aphid", "moth", "larvae", "worm", "holes"},
    "fertilizer": {"fertilizer", "fertiliser", "nitrogen", "npk", "nutrient", "compost"},
    "watering": {"water", "watering", "irrigate", "irrigation", "dry", "wet", "wilt"},
    "technique": {"mulch", "mulching", "compost", "scout", "seedling", "plant", "technique"},
    "safety": {"pesticide", "chemical", "officer", "safety", "spray"},
}


@dataclass
class ScoredRecord:
    record: KnowledgeRecord
    score: float


def tokenize(text: str) -> list[str]:
    return [t for t in TOKEN_RE.findall(text.lower()) if t not in STOPWORDS and len(t) > 1]


def looks_like_farming(question: str) -> bool:
    tokens = set(tokenize(question))
    if tokens & FARMING_HINTS:
        return True
    # Short follow-ups may rely on history; treat as farming if empty of strong non-farm signal
    return False


def guess_intent(question: str, top: KnowledgeRecord | None) -> str:
    tokens = set(tokenize(question))
    best_intent = "other"
    best_hits = 0
    for intent, words in INTENT_KEYWORDS.items():
        hits = len(tokens & words)
        if hits > best_hits:
            best_hits = hits
            best_intent = intent
    if best_hits == 0 and top is not None:
        return top.topic
    return best_intent


def retrieve(
    question: str,
    records: list[KnowledgeRecord],
    top_k: int = 3,
) -> list[ScoredRecord]:
    query_tokens = tokenize(question)
    if not query_tokens:
        return []

    query_set = set(query_tokens)
    scored: list[ScoredRecord] = []

    for record in records:
        doc_tokens = tokenize(record.search_text())
        if not doc_tokens:
            continue
        doc_set = set(doc_tokens)
        overlap = query_set & doc_set
        if not overlap:
            continue

        # Weighted score: overlap ratio + bonus for crop/topic hits
        overlap_score = len(overlap) / max(len(query_set), 1)
        bonus = 0.0
        if record.crop.lower() in query_set:
            bonus += 0.25
        if any(token in query_set for token in tokenize(record.topic)):
            bonus += 0.1
        if any(token in query_set for token in tokenize(record.question)):
            bonus += 0.15

        score = overlap_score + bonus
        scored.append(ScoredRecord(record=record, score=score))

    scored.sort(key=lambda item: item.score, reverse=True)
    return scored[:top_k]


def format_context(scored: list[ScoredRecord]) -> str:
    blocks: list[str] = []
    for item in scored:
        r = item.record
        blocks.append(
            "\n".join(
                [
                    f"ID: {r.id}",
                    f"Crop: {r.crop}",
                    f"Topic: {r.topic}",
                    f"Question: {r.question}",
                    f"Symptoms: {', '.join(r.symptoms)}",
                    f"Possible causes: {', '.join(r.possible_causes)}",
                    f"Solution: {r.solution}",
                    f"Answer: {r.answer}",
                    f"Match score: {item.score:.3f}",
                ]
            )
        )
    return "\n\n---\n\n".join(blocks)


def structured_from_record(record: KnowledgeRecord) -> str:
    causes = ", ".join(record.possible_causes) or "See details below"
    return (
        f"**Possible cause:** {causes}\n\n"
        f"**What to do:** {record.solution}\n\n"
        f"**Details:** {record.answer}\n\n"
        "**Ask an officer if:** The problem spreads quickly, you need chemical control, "
        "or you are unsure about dosages."
    )
