"""Load knowledge base articles from the SQLite database (web/dev.db).

This is the sync path: the admin portal writes articles to SQLite via Prisma,
and the backend reads them here to keep the RAG pipeline up to date. SQLite is
the only source of truth (the old CSV loader was removed).
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

from .canonical import canonical_crop, canonical_crops
from .config import settings
from .knowledge import KnowledgeRecord

# Same DB file the web admin portal uses (Prisma). Overridable via the
# SQLITE_DB_PATH env var / backend/.env so the backend can point at the exact
# dev.db the portal writes to (matters when the two are ever separated).
_DB_PATH = (
    Path(settings.sqlite_db_path).expanduser()
    if getattr(settings, "sqlite_db_path", "")
    else Path(__file__).resolve().parent.parent.parent / "web" / "dev.db"
)


def db_path() -> Path:
    """Exposed so /health and startup logs can show which DB is in use."""
    return _DB_PATH


def quick_signature() -> str | None:
    """Cheap change signal without reading article content.

    Returns ``"<row_count>:<max_updatedAt>"`` (or ``None`` if the DB is
    missing/unreadable). Used by the hot-path reload check so we don't pay the
    cost of loading every article's full text + recomputing a fingerprint on
    each chat request just to detect an edit.
    """
    if not _DB_PATH.exists():
        return None
    try:
        conn = sqlite3.connect(str(_DB_PATH))
        try:
            row = conn.execute(
                "SELECT COUNT(*), MAX(updatedAt) FROM Article"
            ).fetchone()
        finally:
            conn.close()
        return f"{row[0]}:{row[1]}"
    except Exception:
        return None


def load_knowledge_from_sqlite() -> list[KnowledgeRecord]:
    """Read all articles from the SQLite Article table."""
    if not _DB_PATH.exists():
        return []

    conn = sqlite3.connect(str(_DB_PATH))
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(
            "SELECT id, title, category, crop, content, source, tags, "
            "region, language, verified, updatedAt FROM Article ORDER BY id"
        ).fetchall()
        # Many-to-many relations (driven by the admin portal's category/crop pickers).
        cat_rows = conn.execute(
            "SELECT articleId, category FROM ArticleCategory"
        ).fetchall()
        crop_rows = conn.execute(
            "SELECT articleId, crop FROM ArticleCrop"
        ).fetchall()
    finally:
        conn.close()

    categories_by_article: dict[str, list[str]] = {}
    for r in cat_rows:
        categories_by_article.setdefault(str(r["articleId"]), []).append(
            str(r["category"] or "")
        )
    crops_by_article: dict[str, list[str]] = {}
    for r in crop_rows:
        crops_by_article.setdefault(str(r["articleId"]), []).append(
            str(r["crop"] or "")
        )

    records: list[KnowledgeRecord] = []
    for row in rows:
        tags_raw = row["tags"] or ""
        # Support both comma-separated (new) and semicolon-separated (legacy).
        tags = [
            t.strip()
            for t in tags_raw.replace(";", ",").split(",")
            if t.strip()
        ]
        aid = str(row["id"])
        crop_raw = str(row["crop"] or "")
        crops_raw = crops_by_article.get(aid, [])
        records.append(
            KnowledgeRecord(
                id=aid,
                title=str(row["title"] or ""),
                category=str(row["category"] or "general"),
                # Crop labels are canonicalized (e.g. "ကြက်သွန်နီ" -> "onion")
                # so the vector store's metadata filter can exact-match them;
                # the raw labels ride along on the record for embedding + gate.
                crop=canonical_crop(crop_raw),
                crops=canonical_crops(crops_raw),
                content=str(row["content"] or ""),
                source=str(row["source"] or ""),
                tags=tags,
                region=str(row["region"] or ""),
                language=str(row["language"] or "my"),
                verified=bool(row["verified"]),
                updated_at=str(row["updatedAt"] or ""),
                categories=[
                    c for c in categories_by_article.get(aid, []) if c
                ],
                crop_raw=crop_raw,
                crops_raw=crops_raw,
            )
        )
    return records


def load_knowledge_record_by_id(aid: str) -> KnowledgeRecord | None:
    """Read a single article (with its category/crop relations) from SQLite.

    Used for incremental sync: when the portal edits one article we only need
    that one record, not the whole KB. Mirrors the per-row logic of
    ``load_knowledge_from_sqlite``.
    """
    if not _DB_PATH.exists():
        return None

    conn = sqlite3.connect(str(_DB_PATH))
    conn.row_factory = sqlite3.Row
    try:
        row = conn.execute(
            "SELECT id, title, category, crop, content, source, tags, "
            "region, language, verified, updatedAt FROM Article WHERE id = ?",
            (aid,),
        ).fetchone()
        if row is None:
            return None
        cat_rows = conn.execute(
            "SELECT category FROM ArticleCategory WHERE articleId = ?", (aid,)
        ).fetchall()
        crop_rows = conn.execute(
            "SELECT crop FROM ArticleCrop WHERE articleId = ?", (aid,)
        ).fetchall()
    finally:
        conn.close()

    tags_raw = row["tags"] or ""
    tags = [
        t.strip()
        for t in tags_raw.replace(";", ",").split(",")
        if t.strip()
    ]
    record_id = str(row["id"])
    crop_raw = str(row["crop"] or "")
    crops_raw = [str(r["crop"] or "") for r in crop_rows]
    return KnowledgeRecord(
        id=record_id,
        title=str(row["title"] or ""),
        category=str(row["category"] or "general"),
        # Canonicalized exactly like load_knowledge_from_sqlite so incremental
        # sync and full reloads produce identical records.
        crop=canonical_crop(crop_raw),
        crops=canonical_crops(crops_raw),
        content=str(row["content"] or ""),
        source=str(row["source"] or ""),
        tags=tags,
        region=str(row["region"] or ""),
        language=str(row["language"] or "my"),
        verified=bool(row["verified"]),
        updated_at=str(row["updatedAt"] or ""),
        categories=[str(r["category"] or "") for r in cat_rows],
        crop_raw=crop_raw,
        crops_raw=crops_raw,
    )
