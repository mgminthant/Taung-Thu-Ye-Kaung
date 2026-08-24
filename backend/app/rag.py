"""RAG pipeline: the brain behind the /chat endpoint.

This module owns the *orchestration* of a chat turn, so that main.py stays a
thin HTTP layer. The flow for every question is:

    user question
        │
        ▼
   0. Agriculture gate (LLM) — refuse non-agriculture questions *before* any
      retrieval work. Offline fallback (no LLM key): an explicit crop mention or
      an ongoing farming conversation; otherwise refuse rather than guess.
        │ agriculture?
        │ no                        yes
        ▼                           ▼
   "farming questions         1. Intent + NER stage (LLM) — one structured JSON
    only" reply                   call returns {intent, crop, disease, pest,
    (no further work)             symptom, ...}. Fallback: simple defaults.
                                             │
                                             ▼
                                2. Build the retrieval query from the intent +
                                   entities, optionally filter ChromaDB by the
                                   detected crop.
                                             │
                                             ▼
                                3. Semantic search (vectorstore.py)
                                   ChromaDB dense retrieval + cross-encoder re-rank
                                             │
                                             ▼
                                4. Strong match?   (relevance above threshold)
                                      │ no                    │ yes
                                      ▼                        ▼
                                5. "I haven't learned    6. Answer via LLM grounded
                                   that yet." reply           ONLY in the retrieved
                                   (no answer LLM call)       knowledge, or from the
                                                              best article if no LLM
                                                              key / LLM error.

Important change: the answer LLM is **never called when the knowledge base has
no match** — the bot honestly says it has not learned that yet, instead of
hallucinating a general-knowledge answer.
"""
from __future__ import annotations

import logging
import re

from .canonical import canonical_crop
from .config import settings
from .knowledge import KnowledgeRecord
from .llm import (
    ANSWER_FAILED_REPLY,
    ANSWER_FAILED_REPLY_EN,
    CROP_MYANMAR_HINTS,
    OUT_OF_SCOPE_REPLY,
    OUT_OF_SCOPE_REPLY_EN,
    SERVICE_UNAVAILABLE_REPLY,
    SERVICE_UNAVAILABLE_REPLY_EN,
    classify_agriculture,
    extract_intent_ner,
    format_gemini_reply,
    generate_answer,
    generate_answer_stream,
    generate_clarification,
    localized,
)
from .retrieval import (
    ScoredRecord,
    build_retrieval_query,
    format_context,
    structured_from_record,
)
from .schemas import ChatMessage, ChatResponse, IntentNerResult, RetrievedSource
from .vectorstore import VectorStore

logger = logging.getLogger(__name__)

# Reply when retrieval found nothing relevant. We intentionally refuse to
# answer from the LLM's general knowledge here (see module docstring).
NO_KNOWLEDGE_REPLY = (
    "ဤမေးခွန်းအတွက် လိုအပ်သော စိုက်ပျိုးရေးအသိပညာကို ကျွန်တော်တို့၏ "
    "Knowledge Base တွင် မတွေ့ရှိရသေးပါ။ သင့်မေးခွန်းကို မှတ်တမ်းတင်ထားပြီး "
    "အသိပညာများ ဖြည့်စွက်ပြီးပါက ဖြေဆိုနိုင်ပါမည်။"
)
NO_KNOWLEDGE_REPLY_EN = (
    "I haven't learned the farming knowledge needed to answer this question "
    "yet. I've noted your question, and once our Knowledge Base is updated "
    "with the right information I'll be able to help."
)

# Reply when the message is just a greeting/small-talk opener — no retrieval,
# no LLM call, and definitely no "not found in KB" answer.
GREETING_REPLY = (
    "မင်္ဂလာပါ။ ကျွန်တော်က MrFarmer — သင့်လယ်ယာစိုက်ပျိုးရေး လက်ထောက်ပါ။ "
    "သီးနှံ၊ ပိုးမွှား၊ ရောဂါ၊ မြေသြဇာ ဒါမှမဟုတ် ရေသွင်းခြင်းအကြောင်း "
    "ဘာမဆို မေးနိုင်ပါတယ်။"
)
GREETING_REPLY_EN = (
    "Hello! I'm MrFarmer, your farming assistant. Ask me anything about crops, "
    "pests, diseases, fertilizer, or watering."
)

# Burmese greeting cores (politeness particles may follow without a space).
_GREETINGS_MM = ("မင်္ဂလာပါ", "မင်ဂလာပါ", "ဟဲလို", "ဟယ်လို", "ဟေးလို", "ဟိုင်း")
# English greeting words — every word in the message must be one of these.
_GREETINGS_EN = {"hi", "hello", "hey", "howdy", "yo", "greetings"}
_GREETINGS_EN_PHRASES = {"goodmorning", "goodafternoon", "goodevening", "goodday"}
# Filler that may trail a greeting ("hi there", "hello bot").
_GREETINGS_EN_FILLERS = {"there", "bot", "mrfarmer", "farmer", "friend"}


def _is_greeting(question: str) -> bool:
    """True when the message is ONLY a greeting (no real question attached)."""
    text = question.strip().lower()
    if not text or len(text) > 40:
        return False
    words = [w.strip(".,!?;:") for w in text.split()]
    if (
        words
        and any(w in _GREETINGS_EN for w in words)
        and all(w in _GREETINGS_EN or w in _GREETINGS_EN_FILLERS for w in words)
    ):
        return True
    compact = "".join(text.split())
    if compact in _GREETINGS_EN_PHRASES:
        return True
    stripped = re.sub(r"[၊။,.!?:\s]+", "", text)
    # Allow a short politeness particle after the core ("မင်္ဂလာပါခင်ဗျာ").
    return any(
        stripped.startswith(g) and len(stripped) - len(g) <= 6 for g in _GREETINGS_MM
    )


def _stream_payload(
    answer: str,
    *,
    out_of_scope: bool,
    used_llm: bool,
    sources: list | None = None,
    intent: str | None = None,
    entities: IntentNerResult | None = None,
    crop: str | None = None,
    topic: str | None = None,
    model: str | None = None,
    needs_clarification: bool = False,
    insufficient_knowledge: bool = False,
) -> dict:
    """Build the final ``done`` event payload for the streaming endpoint."""
    return {
        "answer": answer,
        "out_of_scope": out_of_scope,
        "used_llm": used_llm,
        "needs_clarification": needs_clarification,
        "insufficient_knowledge": insufficient_knowledge,
        "sources": [s.model_dump() for s in sources] if sources else [],
        "intent": intent,
        "entities": entities.model_dump() if entities else None,
        "crop": crop,
        "topic": topic,
        "model": model,
    }


class RagPipeline:
    """Ties together semantic retrieval (vectorstore) and LLM answering.

    Created once at startup with the loaded knowledge base and the built
    vector index, then reused for every request.
    """

    def __init__(self, knowledge: list[KnowledgeRecord], vector_store: VectorStore) -> None:
        self.knowledge = knowledge
        self.vector_store = vector_store
        # Canonical crop values (drive NER grounding + metadata filtering).
        self._crop_values = sorted(
            {c for record in knowledge for c in ([record.crop] + record.crops) if c}
        )
        # Raw labels as typed in the portal (e.g. "ကြက်သွန်နီ") so the
        # agriculture gate can short-circuit on the words farmers actually use.
        self._crop_raw_values = sorted(
            {
                raw
                for record in knowledge
                for raw in (
                    [record.crop_raw]
                    + list(record.crops_raw)
                )
                if raw
            }
        )

    # ------------------------------------------------------------------
    # Retrieval helpers
    # ------------------------------------------------------------------

    # Common English aliases so the KB's multiple labels for one crop are all
    # covered when resolving an NER-detected crop (e.g. "corn" vs "maize").
    _CROP_ALIASES = {
        "corn": "maize",
        "maize": "corn",
    }

    def _crop_synonyms(self, value: str | None) -> list[str] | None:
        """All KB crop strings that could match the detected crop.

        Since every article's crop metadata is canonicalized at load time
        (canonical.py), this is now just: the canonical form of whatever the
        NER stage detected ("ကြက်သွန်နီ", "onion" -> "onion") plus a small
        English alias table for NER variance ("corn"/"maize"). Returns ``None``
        when no crop was detected.
        """
        if not value:
            return None
        v = canonical_crop(value)
        syns: set[str] = {v}
        alias = self._CROP_ALIASES.get(v)
        if alias:
            syns.add(alias)
        return sorted(syns)

    def _retrieve(
        self,
        query: str,
        crop_synonyms: list[str] | None = None,
    ) -> tuple[list[ScoredRecord], KnowledgeRecord | None]:
        """Find knowledge articles for a question.

        Retrieval uses the user's *original* question (any language). The
        embedding model (multilingual-e5) and reranker (multilingual mmarco) are
        multilingual, so an English query matches a Burmese article directly —
        and empirically far better than an LLM-translated Burmese query, which
        frequently mangles crop names (e.g. "maize" -> "noodle soup") and tanks
        relevance. So we never translate the retrieval query.

        When a crop is detected we scope the search to that crop's articles
        (filtering on every synonym from :meth:`_crop_synonyms`). This stops the
        cross-lingual reranker from preferring a wrong-but-similar article
        (e.g. ranking the rice article above the maize one). We pull a wide
        candidate window here (not just ``retrieval_top_k``) because the truly
        relevant article can sit a few ranks down by cosine distance yet score
        highest after re-ranking, and would otherwise be cut off before the
        reranker ever sees it. If the crop-scoped search finds no strong match
        we fall back to a whole-KB search, so a genuinely cross-cutting answer
        (e.g. "use NPK on maize" -> the general NPK article) is still found.
        """
        def _semantic(q: str, where: dict | None) -> list[ScoredRecord]:
            scored = self.vector_store.search(
                q,
                top_k=settings.retrieval_top_k,
                where=where,
            )
            return [item for item in scored if item.relevance >= settings.min_semantic_score]

        if crop_synonyms:
            where = {"$or": [{"crop": c} for c in crop_synonyms]
                     + [{"crops": {"$contains": c}} for c in crop_synonyms]}
            # Wide candidate window so the best article survives to re-ranking.
            candidates = self.vector_store.search(
                query,
                top_k=max(settings.retrieval_top_k, settings.semantic_candidate_k),
                where=where,
            )
            strong = [c for c in candidates if c.relevance >= settings.min_semantic_score]
            # Always also search the whole KB and merge: the exact-match crop
            # filter can hide an article whose crop label differs from the
            # detected one (e.g. "ကြက်သွန်နီ" vs "onion") while another,
            # less relevant sibling passes the threshold. Merging keeps the
            # cross-cutting fallback (e.g. "use NPK on maize" -> general NPK)
            # AND lets the re-ranker see the truly best article.
            unscoped = _semantic(query, None)
            seen = {c.record.id for c in strong}
            strong.extend(c for c in unscoped if c.record.id not in seen)
            strong.sort(key=lambda c: c.relevance, reverse=True)
            strong = strong[: settings.retrieval_top_k]
        else:
            strong = _semantic(query, None)

        top = strong[0].record if strong else None
        return strong, top

    @staticmethod
    def _to_sources(strong: list[ScoredRecord]) -> list[RetrievedSource]:
        """Map matched articles to the slim source objects returned to the app."""
        return [
            RetrievedSource(
                id=item.record.id,
                crop=item.record.crop,
                topic=item.record.category,
                score=round(item.score, 3),
                question=item.record.title,
            )
            for item in strong
        ]

    async def _is_farming(self, question: str, history: list[ChatMessage]) -> bool:
        """LLM-based agriculture gate.

        Deterministic short-circuit first: if the question (or recent history)
        names a crop we actually cover — in English or Myanmar — it is in scope.
        This prevents the LLM gate from refusing a bare crop name like
        "watermelon" / "ဖရဲသီး" even though we have an article for it.
        """
        text = (question + " " + " ".join(h.content for h in history)).lower()
        if any(crop.lower() in text for crop in self._crop_values):
            return True
        if any(raw.lower() in text for raw in self._crop_raw_values):
            return True
        if any(mm in text for mm in CROP_MYANMAR_HINTS.values()):
            return True
        # The gate is LLM-only. If we have no LLM key we never reach here (answer()
        # refuses early), and if the gate LLM call fails we refuse rather than
        # guessing from history.
        try:
            return await classify_agriculture(question, history)
        except Exception as exc:
            logger.warning("Agriculture gate LLM failed, refusing: %s", exc)
            return False

    def _needs_clarification(self, ner: IntentNerResult) -> bool:
        """A farming question is on-topic but missing info the KB needs.

        When retrieval finds no strong match we should ask a friendly follow-up
        (crop / disease / symptom) instead of guessing or saying "no info".
        """
        # Intents that are meaningless without knowing the crop.
        crop_required = {
            "CULTIVATION", "DISEASE_IDENTIFICATION", "DISEASE_TREATMENT",
            "PEST_CONTROL", "FERTILIZER", "WATER_MANAGEMENT", "HARVESTING",
            "PREVENTION",
        }
        if ner.intent in crop_required and not ner.crop:
            return True
        # Disease/pest intents with no disease, pest, or symptom to ground on.
        if ner.intent in ("DISEASE_IDENTIFICATION", "DISEASE_TREATMENT", "PEST_CONTROL"):
            if not (ner.disease or ner.pest or ner.symptom):
                return True
        return False

    async def _clarify_response(
        self, question: str, ner: IntentNerResult, history: list[ChatMessage]
    ) -> ChatResponse | None:
        """Ask ONE friendly follow-up for a missing crop / disease / symptom.

        Returns None if the clarification LLM is unavailable or fails, so the
        caller can fall back to the honest "no knowledge" reply.
        """
        if not settings.openrouter_api_key:
            return None
        try:
            clarification = await generate_clarification(question, ner, history)
        except Exception as exc:
            logger.warning("Clarification LLM failed: %s", exc)
            return None
        return ChatResponse(
            answer=format_gemini_reply(clarification),
            intent=ner.intent,
            entities=ner,
            out_of_scope=False,
            used_llm=True,
            needs_clarification=True,
            model=settings.openrouter_model,
            sources=[],
        )

    async def _analyze(
        self,
        question: str,
        history: list[ChatMessage],
    ) -> IntentNerResult:
        """Intent + NER stage: LLM extraction. Falls back to defaults."""
        if settings.openrouter_api_key:
            try:
                # Ground NER on BOTH canonical and raw KB crop labels:
                # whichever spelling an article actually uses, the model
                # echoes it back and the exact-match metadata filter hits
                # deterministically.
                all_crops = sorted(set(self._crop_values) | set(self._crop_raw_values))
                return await extract_intent_ner(
                    question, history, crops=all_crops
                )
            except Exception as exc:
                logger.warning("Intent+NER LLM failed, using defaults: %s", exc)
        # Simple fallback: return defaults so retrieval can still build a query.
        return IntentNerResult(intent="OTHER")

    # ------------------------------------------------------------------
    # Main entry point
    # ------------------------------------------------------------------

    async def answer(self, question: str, history: list[ChatMessage]) -> ChatResponse:
        """Produce a full chat answer for one user message."""
        # Pure greetings get a friendly hello — no retrieval, no LLM, no
        # "not found in KB" reply. Works even without an LLM key.
        if _is_greeting(question):
            return ChatResponse(
                answer=localized(question, GREETING_REPLY, GREETING_REPLY_EN),
                intent="greeting",
                out_of_scope=False,
                used_llm=False,
                sources=[],
            )

        # No LLM configured -> there is no answer path and no fallback. Refuse
        # explicitly instead of guessing from a template or prior history.
        if not settings.openrouter_api_key:
            return ChatResponse(
                answer=localized(question, SERVICE_UNAVAILABLE_REPLY, SERVICE_UNAVAILABLE_REPLY_EN),
                intent="out_of_scope",
                out_of_scope=True,
                used_llm=False,
                sources=[],
            )

        # Step 1: intent + NER (drives the retrieval query + crop filter).
        ner = await self._analyze(question, history)
        # Build the retrieval query from the user's ORIGINAL question. The
        # multilingual embedding + reranker match it against the Burmese KB
        # directly; translating to Burmese was harming relevance. The NER crop
        # is also folded into the query by build_retrieval_query, which already
        # aligns it with the KB's own (English) crop vocabulary.
        query = build_retrieval_query(question, ner)
        crop_synonyms = self._crop_synonyms(ner.crop)

        # Step 2: retrieve BEFORE the scope gate. If we actually have a strong
        # knowledge match we answer it — never refuse a question we can answer.
        strong, top = self._retrieve(query, crop_synonyms=crop_synonyms)
        sources = self._to_sources(strong)

        # Strong match -> answer from the knowledge base. But if the user never
        # named a crop (or disease) yet we matched a specific-crop article, the
        # match is a guess we can't trust — clarify instead of answering about
        # the wrong crop (e.g. "how to grow?" should not silently answer maize).
        if top is not None:
            if self._needs_clarification(ner) and top.crop:
                clar = await self._clarify_response(question, ner, history)
                if clar is not None:
                    return clar

            intent = ner.intent
            crop = top.crop
            topic = top.category
            context = format_context(strong)
            try:
                answer = await generate_answer(
                    question=question,
                    context=context,
                    history=history,
                )
                return ChatResponse(
                    answer=format_gemini_reply(answer),
                    crop=crop,
                    topic=topic,
                    intent=intent,
                    entities=ner,
                    sources=sources,
                    out_of_scope=False,
                    used_llm=True,
                    model=settings.openrouter_model,
                )
            except Exception as exc:
                logger.warning("generate_answer failed, no fallback: %s", exc)
                return ChatResponse(
                    answer=localized(question, ANSWER_FAILED_REPLY, ANSWER_FAILED_REPLY_EN),
                    crop=crop,
                    topic=topic,
                    intent=intent,
                    entities=ner,
                    sources=sources,
                    out_of_scope=False,
                    used_llm=False,
                    model=None,
                )

        # Step 3: no knowledge match — now consult the gate to decide between
        # "out of scope" (refuse) and "haven't learned that yet" (honest).
        if not await self._is_farming(question, history):
            return ChatResponse(
                answer=localized(question, OUT_OF_SCOPE_REPLY, OUT_OF_SCOPE_REPLY_EN),
                intent="out_of_scope",
                out_of_scope=True,
                used_llm=False,
                sources=[],
            )

        # On-topic but missing a key detail (crop / disease / symptom): ask a
        # friendly follow-up instead of guessing or returning "no info".
        if self._needs_clarification(ner):
            clar = await self._clarify_response(question, ner, history)
            if clar is not None:
                return clar

        return ChatResponse(
            answer=localized(question, NO_KNOWLEDGE_REPLY, NO_KNOWLEDGE_REPLY_EN),
            intent=ner.intent,
            entities=ner,
            out_of_scope=False,
            used_llm=False,
            sources=[],
            insufficient_knowledge=True,
        )

    async def answer_stream(self, question: str, history: list[ChatMessage]):
        """Stream a chat turn as Server-Sent-Events-friendly dicts.

        Yields ``{"type": "token", "text": <str>}`` chunks as the answer is
        generated, then a single ``{"type": "done", "payload": <dict>}`` carrying
        the same metadata a normal :meth:`answer` would return (sources, intent,
        entities, ...). The non-streaming :meth:`answer` is the source of truth
        for the decision flow; this just streams the produced text.
        """
        # Pure greetings get a friendly hello (no retrieval, no LLM call).
        if _is_greeting(question):
            reply = localized(question, GREETING_REPLY, GREETING_REPLY_EN)
            yield {"type": "token", "text": reply}
            yield {"type": "done", "payload": _stream_payload(
                reply, out_of_scope=False, used_llm=False, intent="greeting",
            )}
            return

        # No LLM configured -> strict refuse (no fallback), then done.
        if not settings.openrouter_api_key:
            reply = localized(question, SERVICE_UNAVAILABLE_REPLY, SERVICE_UNAVAILABLE_REPLY_EN)
            yield {"type": "token", "text": reply}
            yield {"type": "done", "payload": _stream_payload(
                reply, out_of_scope=True, used_llm=False,
            )}
            return

        # Step 1: intent + NER (drives the retrieval query + crop filter).
        ner = await self._analyze(question, history)
        # Build the retrieval query from the user's ORIGINAL question. The
        # multilingual embedding + reranker match it against the Burmese KB
        # directly; translating to Burmese was harming relevance. The NER crop
        # is also folded into the query by build_retrieval_query, which already
        # aligns it with the KB's own (English) crop vocabulary.
        query = build_retrieval_query(question, ner)
        crop_synonyms = self._crop_synonyms(ner.crop)

        # Step 2: retrieve BEFORE the scope gate (never refuse what we can answer).
        strong, top = self._retrieve(query, crop_synonyms=crop_synonyms)
        sources = self._to_sources(strong)

        if top is not None:
            # Strong match -> answer from the knowledge base. Clarify first if the
            # match is for a specific crop but the user never named one.
            if self._needs_clarification(ner) and top.crop:
                clar = await self._clarify_response(question, ner, history)
                if clar is not None:
                    yield {"type": "token", "text": clar.answer}
                    yield {"type": "done", "payload": _stream_payload(
                        clar.answer,
                        out_of_scope=False,
                        used_llm=True,
                        sources=clar.sources,
                        intent=clar.intent,
                        entities=clar.entities,
                        crop=clar.crop,
                        topic=clar.topic,
                        model=clar.model,
                        needs_clarification=True,
                    )}
                    return

            intent = ner.intent
            crop = top.crop
            topic = top.category
            context = format_context(strong)
            chunks: list[str] = []
            try:
                async for chunk in generate_answer_stream(
                    question=question, context=context, history=history
                ):
                    chunks.append(chunk)
                    yield {"type": "token", "text": chunk}
                reply = format_gemini_reply("".join(chunks))
                yield {"type": "done", "payload": _stream_payload(
                    reply,
                    out_of_scope=False,
                    used_llm=True,
                    sources=sources,
                    intent=intent,
                    entities=ner,
                    crop=crop,
                    topic=topic,
                    model=settings.openrouter_model,
                )}
            except Exception as exc:
                logger.warning(
                    "generate_answer_stream failed, falling back to non-stream: %r",
                    exc,
                    exc_info=True,
                )
                # Streaming broke (provider/network). Recover with a single
                # non-streaming call so the user still gets a complete answer
                # instead of an error message.
                try:
                    reply = await generate_answer(question, context, history)
                    used_llm_fallback = True
                except Exception as exc2:
                    logger.warning(
                        "generate_answer fallback also failed: %r", exc2, exc_info=True
                    )
                    reply = localized(question, ANSWER_FAILED_REPLY, ANSWER_FAILED_REPLY_EN)
                    used_llm_fallback = False
                yield {"type": "token", "text": reply}
                yield {"type": "done", "payload": _stream_payload(
                    reply,
                    out_of_scope=False,
                    used_llm=used_llm_fallback,
                    sources=sources,
                    intent=intent,
                    entities=ner,
                    crop=crop,
                    topic=topic,
                    model=settings.openrouter_model if used_llm_fallback else None,
                )}
            return

        # Step 3: no knowledge match — consult the gate.
        if not await self._is_farming(question, history):
            reply = localized(question, OUT_OF_SCOPE_REPLY, OUT_OF_SCOPE_REPLY_EN)
            yield {"type": "token", "text": reply}
            yield {"type": "done", "payload": _stream_payload(
                reply, out_of_scope=True, used_llm=False, intent="out_of_scope",
            )}
            return

        # On-topic but missing a key detail: ask a friendly follow-up.
        if self._needs_clarification(ner):
            clar = await self._clarify_response(question, ner, history)
            if clar is not None:
                yield {"type": "token", "text": clar.answer}
                yield {"type": "done", "payload": _stream_payload(
                    clar.answer,
                    out_of_scope=False,
                    used_llm=True,
                    sources=clar.sources,
                    intent=clar.intent,
                    entities=clar.entities,
                    needs_clarification=True,
                )}
                return

        reply = localized(question, NO_KNOWLEDGE_REPLY, NO_KNOWLEDGE_REPLY_EN)
        yield {"type": "token", "text": reply}
        yield {"type": "done", "payload": _stream_payload(
            reply, out_of_scope=False, used_llm=False, intent=ner.intent, entities=ner,
            insufficient_knowledge=True,
        )}
