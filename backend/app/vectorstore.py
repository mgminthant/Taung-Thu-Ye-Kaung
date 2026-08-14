"""Semantic search layer: embeddings + vector DB + cross-encoder re-rank.

Why two models?
- The *embedding* model (multilingual-e5-small) turns text into vectors so
  ChromaDB can quickly find similar records. It is fast but scores everything
  high (even irrelevant text ~0.8), so it cannot decide "is this a real match".
- The *cross-encoder* re-ranks the few top candidates and gives a reliable
  relevance signal: positive = real match, negative = no match. That score is
  what rag.py uses to decide whether to fall back to the LLM.

Why "query: / passage: " prefixes?
  e5 models are trained with asymmetric prefixes; using them is required to get
  good similarities. A query is prefixed "query: ", a stored document "passage: ".
"""
from __future__ import annotations

import hashlib
import re
from pathlib import Path

import chromadb

from .config import settings
from .knowledge import KnowledgeRecord
from .retrieval import ScoredRecord

# All collections start with this prefix; the model name is appended so that
# switching embedding models automatically creates a fresh collection.
COLLECTION_PREFIX = "agriculture_knowledge"

# The cross-encoder is expensive to load, so load it once and reuse it.
_RERANKER = None


def _fingerprint(texts: list[str]) -> str:
    """Short stable hash of the embedded texts, used to detect KB edits."""
    digest = hashlib.sha256("\n".join(texts).encode("utf-8")).hexdigest()
    return digest[:16]


def _get_reranker():
    """Lazily load and cache the cross-encoder re-ranker (one-time download)."""
    global _RERANKER
    if _RERANKER is None:
        from sentence_transformers import CrossEncoder

        _RERANKER = CrossEncoder(settings.rerank_model, max_length=512)
    return _RERANKER


class SentenceTransformerEmbedding:
    """ChromaDB-compatible wrapper around a sentence-transformers model.

    ChromaDB calls ``embed_documents`` when storing and ``embed_query`` when
    searching. The ``name()`` method lets Chroma persist which function was used.
    """

    def __init__(self, model_name: str) -> None:
        from sentence_transformers import SentenceTransformer

        self.model_name = model_name
        self._model = SentenceTransformer(model_name)
        # e5 models need "query:" / "passage:" prefixes; other models do not.
        self._is_e5 = "e5" in model_name.lower()

    def name(self) -> str:
        return f"sentence-transformers/{self.model_name}"

    def _embed(self, input, prefix: str) -> list[list[float]]:
        if not self._is_e5:
            prefix = ""
        # normalize_embeddings=True so cosine similarity == dot product.
        return self._model.encode(
            [prefix + text for text in input],
            normalize_embeddings=True,
        ).tolist()

    def embed_documents(self, input) -> list[list[float]]:
        return self._embed(input, prefix="passage: ")

    def embed_query(self, input) -> list[list[float]]:
        texts = [input] if isinstance(input, str) else input
        return self._embed(texts, prefix="query: ")

    def __call__(self, input) -> list[list[float]]:
        return self._embed(input, prefix="passage: ")


class VectorStore:
    """Persistent ChromaDB index over the knowledge base.

    - Stores one vector per knowledge record (the record's ``search_text()``).
    - ``ensure_indexed`` rebuilds the index only when the data or model changed.
    - ``search`` does dense retrieval + cross-encoder re-ranking.
    """

    def __init__(
        self,
        persist_dir: str | Path,
        embedding_model: str = settings.embedding_model,
    ) -> None:
        self.persist_dir = Path(persist_dir)
        self.persist_dir.mkdir(parents=True, exist_ok=True)
        self.embedding = SentenceTransformerEmbedding(embedding_model)
        self._client = chromadb.PersistentClient(path=str(self.persist_dir))
        self._records: dict[str, KnowledgeRecord] = {}

    def _collection_name(self) -> str:
        """Unique collection per embedding model (e.g. ...--intfloat-multilingual-e5-small)."""
        slug = re.sub(r"[^a-z0-9]+", "-", self.embedding.model_name.lower()).strip("-")
        return f"{COLLECTION_PREFIX}--{slug}"

    def _get_collection(self):
        return self._client.get_or_create_collection(
            name=self._collection_name(),
            embedding_function=self.embedding,
            metadata={"hnsw:space": "cosine"},
        )

    def ensure_indexed(self, records: list[KnowledgeRecord]) -> None:
        """Index the records, but skip the work if the index is already up to date.

        Also deletes stale collections from older embedding models to save disk.

        The index is rebuilt when (a) the embedding model changed (new
        collection name), (b) the record count changed, or (c) the embedded
        text changed — detected via a fingerprint stored in the collection
        metadata. This matters because we only embed *title + content*; editing
        an article must refresh its vector.
        """
        self._records = {record.id: record for record in records}

        # Stable fingerprint of everything that is embedded.
        fingerprint = _fingerprint([record.search_text() for record in records])

        # Remove collections built with a different embedding model.
        current = self._collection_name()
        for collection in self._client.list_collections():
            if collection.name.startswith(COLLECTION_PREFIX) and collection.name != current:
                self._client.delete_collection(collection.name)

        # Already indexed for this model, size, and embedded text → nothing to do.
        collection = self._get_collection()
        if collection.count() == len(records) and collection.metadata.get("fingerprint") == fingerprint:
            return

        # Data changed: drop and rebuild this collection.
        if collection.count() > 0:
            self._client.delete_collection(current)
            collection = self._get_collection()
        if not records:
            return

        collection.upsert(
            ids=[record.id for record in records],
            documents=[record.search_text() for record in records],
            # Metadata is kept separate from the embedded text (title+content)
            # so it can drive filtering and analytics without polluting the
            # semantic index (see prd.md §13).
            metadatas=[
                {
                    "title": record.title,
                    "category": record.category,
                    "crop": record.crop,
                    "tags": record.tags,
                    "language": record.language,
                    "source": record.source,
                }
                for record in records
            ],
        )

        # Persist the fingerprint so future startups can detect content edits.
        # (Only touch the fingerprint key — chroma forbids changing hnsw:space.)
        collection.modify(metadata={"fingerprint": fingerprint})

    def search(self, question: str, top_k: int) -> list[ScoredRecord]:
        """Retrieve the most relevant records for ``question``.

        1. ChromaDB returns ``semantic_candidate_k`` candidates by cosine distance.
        2. A cross-encoder re-ranks them and assigns ``relevance`` (a raw logit).
        3. Results are returned sorted by cosine similarity (score) for display;
           rag.py uses ``relevance`` to decide whether there is a real match.
        """
        collection = self._get_collection()
        count = collection.count()
        if count == 0:
            return []

        # Fetch a few extra candidates than we need so the re-ranker can pick
        # the best ones, even if the dense top-3 is slightly off.
        candidate_k = max(top_k, settings.semantic_candidate_k)
        try:
            result = collection.query(
                query_texts=[question],
                n_results=min(candidate_k, count),
                include=["distances"],
            )
        except Exception:
            return []

        # Convert Chroma distances to a 0..1 cosine-similarity score.
        candidates: list[ScoredRecord] = []
        for record_id, distance in zip(
            result.get("ids", [[]])[0],
            result.get("distances", [[]])[0],
        ):
            record = self._records.get(record_id)
            if record is None:
                continue
            score = max(0.0, min(1.0, 1.0 - distance))
            candidates.append(ScoredRecord(record=record, score=score))

        if not candidates:
            return []
        if len(candidates) == 1:
            candidates[0].relevance = candidates[0].score
            return candidates

        # Cross-encoder re-ranking: (question, document) pairs → relevance logits.
        reranker = _get_reranker()
        pairs = [(question, item.record.search_text()) for item in candidates]
        logits = reranker.predict(pairs)
        for item, logit in zip(candidates, logits):
            item.relevance = float(logit)

        candidates.sort(key=lambda item: item.score, reverse=True)
        return candidates[:top_k]
