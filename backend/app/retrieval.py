"""Lexical (keyword) retrieval + intent/topic helpers.

The primary retrieval path is semantic (vectorstore.py); this module is the
cheap fallback and provides shared utilities: tokenization (works for both
Latin and Myanmar script), a farming topic gate, intent tagging, and the text
formatters used to build LLM context and offline answers.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from .knowledge import KnowledgeRecord

# Matches words made of Latin letters/digits OR Myanmar script characters.
# Myanmar has no spaces between words, so each contiguous script run is a token.
TOKEN_RE = re.compile(r"[a-z0-9\u1000-\u109f]+")

# Common English words that carry no retrieval signal.
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


# English words that strongly suggest the question is about farming.
# Used by the out-of-scope gate to refuse non-farming questions early.
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


# Myanmar keywords used by the same gate. Because Myanmar text has no word
# boundaries, these are matched as substrings rather than exact tokens.
BURMESE_FARMING_HINTS = (
    "စပါး",
    "ခရမ်းချဉ်",
    "ငရုတ်",
    "ဂေါ်ဖီ",
    "ခရမ်း",
    "ကြက်သွန်",
    "ကြက်သွန်နီ",
    "ပြောင်း",
    "ပဲ",
    "သီးနှံ",
    "စိုက်ပျိုး",
    "စိုက်",
    "အပင်",
    "အရွက်",
    "ပိုး",
    "ပိုးမွှား",
    "ပိုးသတ်ဆေး",
    "ရောဂါ",
    "မျိုးအောင်",
    "ဓာတ်မြေသြဇာ",
    "မြေ",
    "ရေ",
    "ရေသွင်း",
    "မြက်ဖုံး",
    "မြေဆွေး",
    "မျိုးစေ့",
    "ပျိုး",
    "ရိတ်သိမ်း",
    "ပေါင်း",
    "ပေါင်းမြက်",
    "သစ်သီး",
    "ဟင်းသီးဟင်းရွက်",
)


# Words that hint at the *type* of farming problem (disease, pest, fertilizer...).
# Used to tag the answer's "intent" shown in the UI. Best-effort heuristics.
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
    """A knowledge record plus two scores:

    - ``score``     0..1 cosine similarity (nice for display).
    - ``relevance`` cross-encoder logit used for the match/no-match decision
                    (positive = real match, negative = no match). For lexical
                    results relevance == score.
    """

    record: KnowledgeRecord
    score: float
    relevance: float = 0.0


def tokenize(text: str) -> list[str]:
    """Split text into lowercase tokens, dropping stopwords and 1-char tokens."""
    return [t for t in TOKEN_RE.findall(text.lower()) if t not in STOPWORDS and len(t) > 1]


def looks_like_farming(question: str) -> bool:
    """True if the question mentions agriculture (Myanmar substring or English words)."""
    text = question.lower()
    if any(hint in text for hint in BURMESE_FARMING_HINTS):
        return True
    tokens = set(tokenize(question))
    if tokens & FARMING_HINTS:
        return True
    return False


def guess_intent(question: str, top: KnowledgeRecord | None) -> str:
    """Tag the question as pest/disease/fertilizer/... or reuse the matched category.

    The keyword heuristic is a best-effort tag for the UI. When no keyword hits,
    fall back to the matched article's category (disease / pest / fertilizer /
    water_management / cultivation / prevention / ...) so the tag is still useful.
    """
    tokens = set(tokenize(question))
    best_intent = "other"
    best_hits = 0
    for intent, words in INTENT_KEYWORDS.items():
        hits = len(tokens & words)
        if hits > best_hits:
            best_hits = hits
            best_intent = intent
    if best_hits == 0 and top is not None:
        return top.category
    return best_intent


def retrieve(
    question: str,
    records: list[KnowledgeRecord],
    top_k: int = 3,
) -> list[ScoredRecord]:
    """Keyword retrieval used as a fallback when semantic search finds nothing.

    Scores are a weighted Jaccard-like overlap between the question tokens and
    each record's tokens, with bonuses when the crop/topic/question match.
    """
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

        # Weighted score: overlap ratio + bonus for crop/category/title hits.
        overlap_score = len(overlap) / max(len(query_set), 1)
        bonus = 0.0
        if record.crop.lower() in query_set:
            bonus += 0.25
        if any(token in query_set for token in tokenize(record.category)):
            bonus += 0.1
        if any(token in query_set for token in tokenize(record.title)):
            bonus += 0.15

        score = overlap_score + bonus
        scored.append(ScoredRecord(record=record, score=score, relevance=score))

    scored.sort(key=lambda item: item.score, reverse=True)
    return scored[:top_k]


# Maximum characters of article content handed to the LLM per record, so a
# huge article cannot blow up the prompt.
MAX_CONTEXT_CHARS = 1500


def format_context(scored: list[ScoredRecord]) -> str:
    """Render matched articles as plain text the LLM reads as RAG context.

    Uses the article's title + content (the same text that was embedded).
    """
    blocks: list[str] = []
    for item in scored:
        r = item.record
        content = r.content if len(r.content) <= MAX_CONTEXT_CHARS else r.content[:MAX_CONTEXT_CHARS] + "…"
        blocks.append(
            "\n".join(
                [
                    f"ID: {r.id}",
                    f"Title: {r.title}",
                    f"Category: {r.category}",
                    f"Crop: {r.crop}",
                    f"Content: {content}",
                    f"Match score: {item.score:.3f}",
                ]
            )
        )
    return "\n\n---\n\n".join(blocks)


def structured_from_record(record: KnowledgeRecord) -> str:
    """Offline answer template (used when the LLM is unavailable/unconfigured).

    Simply renders the matched article — the article content already contains
    the symptoms, causes, and solution sections.
    """
    return f"**{record.title}**\n\n{record.content}\n\n_(အရင်းအမြစ်: {record.source})_"
