"""RAG pipeline: the brain behind the /chat endpoint.

This module owns the *orchestration* of a chat turn, so that main.py stays a
thin HTTP layer. The flow for every question is:

    user question
        │
        ▼
  1. Semantic search   (vectorstore.py)
      ChromaDB dense retrieval + cross-encoder re-rank
        │
        ▼
  2. Strong match?     (relevance score above threshold)
        │ no                          │ yes
        ▼                             ▼
  3. "I haven't learned  use the matched knowledge article(s)
     that yet." reply
     (no LLM call)                        │
                                          ▼
  4. Farming gate — refuse non-agriculture questions before an LLM call
                                          │
                                          ▼
  5. Answer via LLM grounded ONLY in the retrieved knowledge,
     or from the best article if no LLM key / LLM error.

Important change: the LLM is **never called when the knowledge base has no
match** — the bot honestly says it has not learned that yet, instead of
hallucinating a general-knowledge answer.
"""
from __future__ import annotations

from .config import settings
from .knowledge import KnowledgeRecord
from .llm import OUT_OF_SCOPE_REPLY, generate_answer, strip_markdown_noise
from .retrieval import (
    ScoredRecord,
    format_context,
    guess_intent,
    looks_like_farming,
    retrieve,
    structured_from_record,
)
from .schemas import ChatMessage, ChatResponse, RetrievedSource
from .vectorstore import VectorStore

# Reply when retrieval found nothing relevant. We intentionally refuse to
# answer from the LLM's general knowledge here (see module docstring).
NO_KNOWLEDGE_REPLY = (
    "ဤမေးခွန်းအတွက် လိုအပ်သော စိုက်ပျိုးရေးအသိပညာကို ကျွန်တော်တို့၏ "
    "Knowledge Base တွင် မတွေ့ရှိရသေးပါ။ သင့်မေးခွန်းကို မှတ်တမ်းတင်ထားပြီး "
    "အသိပညာများ ဖြည့်စွက်ပြီးပါက ဖြေဆိုနိုင်ပါမည်။"
)


class RagPipeline:
    """Ties together semantic retrieval (vectorstore) and LLM answering.

    Created once at startup with the loaded knowledge base and the built
    vector index, then reused for every request.
    """

    def __init__(self, knowledge: list[KnowledgeRecord], vector_store: VectorStore) -> None:
        self.knowledge = knowledge
        self.vector_store = vector_store

    # ------------------------------------------------------------------
    # Retrieval helpers
    # ------------------------------------------------------------------

    def _retrieve(self, question: str) -> tuple[list[ScoredRecord], KnowledgeRecord | None]:
        """Find knowledge articles for a question.

        Returns ``(strong_matches, best_record)``:
        - ``strong_matches``  articles whose relevance passed the threshold.
        - ``best_record``     the highest-ranked article, or ``None`` if no match.

        Semantic search is tried first; if it returns nothing convincing,
        we fall back to the cheap keyword matcher (good for exact crop/topic
        words, e.g. "blast").
        """
        scored = self.vector_store.search(question, top_k=settings.retrieval_top_k)
        strong = [item for item in scored if item.relevance >= settings.min_semantic_score]

        if not strong:
            keyword_scored = retrieve(question, self.knowledge, top_k=settings.retrieval_top_k)
            strong = [
                item for item in keyword_scored if item.relevance >= settings.min_retrieval_score
            ]

        top = strong[0].record if strong else None
        return strong, top

    @staticmethod
    def _to_sources(strong: list[ScoredRecord]) -> list[RetrievedSource]:
        """Map matched articles to the slim source objects returned to the app."""
        return [
            RetrievedSource(
                id=item.record.id,
                crop=item.record.crop,
                # The API keeps the field name `topic` for backward-compatibility
                # with the mobile app; it now carries the article's category.
                topic=item.record.category,
                score=round(item.score, 3),
                question=item.record.title,
            )
            for item in strong
        ]

    @staticmethod
    def _is_farming(question: str, has_match: bool, has_history: bool) -> bool:
        """Gate: only serve agriculture questions.

        A question is treated as farming if it *looks* like farming (English
        keyword list or Myanmar substring hints), or retrieval found a strong
        match, or it is a short follow-up in an existing conversation.
        """
        return looks_like_farming(question) or has_match or has_history

    # ------------------------------------------------------------------
    # Main entry point
    # ------------------------------------------------------------------

    async def answer(self, question: str, history: list[ChatMessage]) -> ChatResponse:
        """Produce a full chat answer for one user message."""
        strong, top = self._retrieve(question)
        sources = self._to_sources(strong)

        # Non-farming questions are refused here, before wasting an LLM call.
        if not self._is_farming(question, bool(strong), bool(history)):
            return ChatResponse(
                answer=OUT_OF_SCOPE_REPLY,
                intent="out_of_scope",
                out_of_scope=True,
                used_llm=False,
                sources=[],
            )

        # No knowledge match -> be honest. Never let the LLM invent an answer
        # from general farming knowledge (this removes the old behavior).
        if top is None:
            return ChatResponse(
                answer=NO_KNOWLEDGE_REPLY,
                intent=guess_intent(question, None),
                out_of_scope=False,
                used_llm=False,
                sources=[],
            )

        # Metadata used for tags / chips shown in the mobile UI.
        intent = guess_intent(question, top)
        crop = top.crop
        topic = top.category
        context = format_context(strong)  # ground truth handed to the LLM (RAG)

        # Preferred path: LLM grounded in the retrieved knowledge.
        if settings.openrouter_api_key:
            try:
                answer = await generate_answer(
                    question=question,
                    context=context,
                    history=history,
                )
                return ChatResponse(
                    answer=strip_markdown_noise(answer),
                    crop=crop,
                    topic=topic,
                    intent=intent,
                    sources=sources,
                    out_of_scope=False,
                    used_llm=True,
                    model=settings.openrouter_model,
                )
            except Exception as exc:  # noqa: BLE001 - LLM down: degrade gracefully
                return ChatResponse(
                    answer=structured_from_record(top) + f"\n\n_(LLM မရရှိနိုင်ပါ: {exc})_",
                    crop=crop,
                    topic=topic,
                    intent=intent,
                    sources=sources,
                    out_of_scope=False,
                    used_llm=False,
                    model=None,
                )

        # No API key configured -> offline retrieval-only mode (local demos).
        return ChatResponse(
            answer=structured_from_record(top),
            crop=crop,
            topic=topic,
            intent=intent,
            sources=sources,
            out_of_scope=False,
            used_llm=False,
            model=None,
        )
