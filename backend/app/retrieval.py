"""Intent/topic helpers for the RAG pipeline.

The primary retrieval + intent path is semantic (vectorstore.py) driven by the
LLM intent/NER stage (llm.py). This module only holds the shared helpers the
pipeline still needs: building the embedding query from an intent+entities
result, and formatting matched articles for the LLM context / offline answers.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from .knowledge import KnowledgeRecord
from .schemas import IntentNerResult

# Myanmar Unicode block (and the Myanmar Tai Laing extension).
_MYANMAR_RE = re.compile(r"[\u1000-\u109F\uAA60-\uAA7F]")


def _has_myanmar(text: str) -> bool:
    return bool(_MYANMAR_RE.search(text))


@dataclass
class ScoredRecord:
    """A knowledge record plus two scores:

    - ``score``     0..1 cosine similarity (nice for display).
    - ``relevance`` cross-encoder logit used for the match/no-match decision
                     (positive = real match, negative = no match).
    """

    record: KnowledgeRecord
    score: float
    relevance: float = 0.0


def build_retrieval_query(question: str, ner: IntentNerResult | None) -> str:
    """Build the embedding query from the question + LLM-extracted entities.

    The query is the user's question plus the entities the LLM NER stage detected
    (crop, disease, pest, symptom, ...). No hardcoded intent hints — the
    multilingual embedding + the LLM entities drive retrieval (prd.md §14).

    Two guards keep the query clean for the embedding model:
    - skip an entity already present in the question (redundant), and
    - skip an *English* entity token on a Myanmar question. The NER often returns
      the crop in English ("maize", "watermelon") while the user typed Myanmar;
      appending that Latin token pollutes the multilingual embedding and can drop
      the correct article below threshold. The unfiltered semantic search already
      matches the crop named in the question, so the English token only hurts.
    """
    parts = [question]
    if ner is not None:
        q_lower = question.lower()
        q_myanmar = _has_myanmar(question)
        for value in (
            ner.crop,
            ner.disease,
            ner.pest,
            ner.symptom,
            ner.fertilizer,
            ner.pesticide,
            ner.plant_part,
        ):
            if not value:
                continue
            v = str(value)
            if v.lower() in q_lower:
                continue
            if q_myanmar and v.isascii():
                continue
            parts.append(v)
    return " ".join(parts)


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
