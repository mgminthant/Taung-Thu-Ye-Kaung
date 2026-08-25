"""SQLite persistence for chat logs, feedback, and user auth — writes to the
same dev.db used by the web admin portal (Prisma).  Uses the built-in
``sqlite3`` module so no extra dependency is needed.
"""

from __future__ import annotations

import hashlib
import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

# Resolve web/dev.db relative to the repo root (two levels up from backend/app/).
_DB_PATH = Path(__file__).resolve().parent.parent.parent / "web" / "dev.db"

_CREATE_TABLES = """
CREATE TABLE IF NOT EXISTS QuestionLog (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    ts         DATETIME NOT NULL DEFAULT (datetime('now')),
    question   TEXT    NOT NULL,
    intent     TEXT,
    entities   TEXT,
    outOfScope INTEGER,
    usedLlm    INTEGER,
    sourceIds  TEXT,
    answer     TEXT,
    responseMs INTEGER,
    userId     TEXT
);

CREATE TABLE IF NOT EXISTS Feedback (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    ts         DATETIME NOT NULL,
    useful     INTEGER NOT NULL,
    message    TEXT    NOT NULL,
    answer     TEXT    NOT NULL,
    sourceIds  TEXT    NOT NULL,
    reason     TEXT,
    comment    TEXT,
    conversationId TEXT,
    createdAt  DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS User (
    id           TEXT PRIMARY KEY,
    username     TEXT NOT NULL UNIQUE,
    displayName  TEXT NOT NULL,
    passwordHash TEXT NOT NULL,
    email        TEXT,
    createdAt    DATETIME NOT NULL DEFAULT (datetime('now'))
);
"""


def _ensure_feedback_columns(conn: sqlite3.Connection) -> None:
    """Idempotent migration for DBs created before prd.md §16 fields existed."""
    existing = {row[1] for row in conn.execute("PRAGMA table_info(Feedback)")}
    for name in ("reason", "comment", "conversationId"):
        if name not in existing:
            conn.execute(f"ALTER TABLE Feedback ADD COLUMN {name} TEXT")


def _ensure_user_columns(conn: sqlite3.Connection) -> None:
    """Idempotent migration adding the Google Sign-In email column."""
    existing = {row[1] for row in conn.execute("PRAGMA table_info(User)")}
    if "email" not in existing:
        conn.execute("ALTER TABLE User ADD COLUMN email TEXT")
        # Best-effort uniqueness; SQLite supports this on nullable columns.
        try:
            conn.execute(
                "CREATE UNIQUE INDEX IF NOT EXISTS User_email_key ON User(email)"
            )
        except sqlite3.DatabaseError:
            pass


def _connect() -> sqlite3.Connection:
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(_DB_PATH))
    conn.executescript(_CREATE_TABLES)
    _ensure_feedback_columns(conn)
    _ensure_user_columns(conn)
    conn.commit()
    return conn


def log_chat(
    *,
    question: str,
    answer: str,
    intent: str | None = None,
    entities: dict | None = None,
    out_of_scope: bool = False,
    used_llm: bool = False,
    source_ids: list[str] | None = None,
    response_ms: int | None = None,
    user_id: str | None = None,
) -> None:
    """Insert one row into the QuestionLog table."""
    conn = _connect()
    try:
        conn.execute(
            """INSERT INTO QuestionLog
               (ts, question, intent, entities, outOfScope, usedLlm, sourceIds, answer, responseMs, userId)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                datetime.now(timezone.utc).isoformat(),
                question,
                intent,
                json.dumps(entities, ensure_ascii=False) if entities else None,
                1 if out_of_scope else 0,
                1 if used_llm else 0,
                json.dumps(source_ids) if source_ids else None,
                answer,
                response_ms,
                user_id,
            ),
        )
        conn.commit()
    finally:
        conn.close()


def log_feedback(
    *,
    message: str,
    answer: str,
    useful: bool,
    source_ids: list[str] | None = None,
    reason: str | None = None,
    comment: str | None = None,
    conversation_id: str | None = None,
) -> None:
    """Insert one row into the Feedback table."""
    conn = _connect()
    try:
        conn.execute(
            """INSERT INTO Feedback (ts, useful, message, answer, sourceIds, reason, comment, conversationId)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                datetime.now(timezone.utc).isoformat(),
                1 if useful else 0,
                message,
                answer,
                json.dumps(source_ids or []),
                reason,
                comment or None,
                conversation_id,
            ),
        )
        conn.commit()
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

def _hash_password(password: str, salt: bytes | None = None) -> tuple[str, bytes]:
    """Return (hex_hash, salt) using SHA-256."""
    if salt is None:
        salt = os.urandom(16)
    h = hashlib.sha256(salt + password.encode("utf-8")).hexdigest()
    return h, salt


def register_user(*, username: str, display_name: str, password: str) -> dict | str:
    """Insert a new user. Returns user dict on success, error string on failure."""
    conn = _connect()
    try:
        existing = conn.execute(
            "SELECT id FROM User WHERE username = ?", (username,)
        ).fetchone()
        if existing:
            return "Username already taken"

        import uuid
        user_id = uuid.uuid4().hex[:12]
        pw_hash, salt = _hash_password(password)
        stored = f"{salt.hex()}:{pw_hash}"

        conn.execute(
            "INSERT INTO User (id, username, displayName, passwordHash) VALUES (?, ?, ?, ?)",
            (user_id, username, display_name, stored),
        )
        conn.commit()
        return {"userId": user_id, "displayName": display_name}
    finally:
        conn.close()


def authenticate_user(*, username: str, password: str) -> dict | str:
    """Verify credentials. Returns user dict on success, error string on failure."""
    conn = _connect()
    try:
        row = conn.execute(
            "SELECT id, displayName, passwordHash FROM User WHERE username = ?",
            (username,),
        ).fetchone()
        if not row:
            return "Invalid username or password"

        user_id, display_name, stored = row
        salt_hex, expected_hash = stored.split(":", 1)
        salt = bytes.fromhex(salt_hex)
        h, _ = _hash_password(password, salt)

        if h != expected_hash:
            return "Invalid username or password"

        return {"userId": user_id, "displayName": display_name}
    finally:
        conn.close()


GOOGLE_PASSWORD_SENTINEL = "google-oauth"


def upsert_google_user(*, email: str, display_name: str) -> dict:
    """Find-or-create the user behind a verified Google account.

    The User.email column is the identity anchor, so a returning Google
    account always reuses its row. Google users never get a local password:
    passwordHash holds a sentinel that cannot collide with the ``salt:hash``
    format produced by _hash_password. Usernames derive from the email
    local-part and are suffixed ``-g``/``-g2``… when already taken.
    """
    conn = _connect()
    try:
        row = conn.execute(
            "SELECT id, displayName FROM User WHERE email = ?", (email,)
        ).fetchone()
        if row:
            return {"userId": row[0], "displayName": row[1]}

        base = email.split("@", 1)[0].lower()[:24] or "farmer"
        username = base
        suffix = 0
        while conn.execute(
            "SELECT 1 FROM User WHERE username = ?", (username,)
        ).fetchone():
            suffix += 1
            username = f"{base}-g{suffix}"

        import uuid
        user_id = uuid.uuid4().hex[:12]
        conn.execute(
            "INSERT INTO User (id, username, displayName, passwordHash, email) VALUES (?, ?, ?, ?, ?)",
            (user_id, username, display_name, GOOGLE_PASSWORD_SENTINEL, email),
        )
        conn.commit()
        return {"userId": user_id, "displayName": display_name}
    finally:
        conn.close()
