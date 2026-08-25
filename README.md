# တောင်သူ့ရဲ့ခေါင် (FarmBot Myanmar)

Text-based farming NLP chatbot — Expo mobile app + FastAPI backend + Next.js admin portal.

```
FarmBotMyanmar/
├── mobile/          # Expo (React Native) chat app
├── web/             # Next.js 16 admin portal (login-gated; Knowledge CRUD, Feedback, Analytics)
├── backend/         # FastAPI + retrieval + OpenRouter RAG
├── data/            # legacy CSV KB (no longer read — SQLite web/dev.db is the source of truth)
├── docs/            # project documentation
└── prd.md           # product requirements
```

## 1. Backend (FastAPI)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Put your OpenRouter key in .env:
# OPENROUTER_API_KEY=sk-or-...
# Seed the knowledge base (25 Myanmar articles) into web/dev.db + rebuild vectors:
python seed_myanmar_agri.py
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- Health: `GET /health` (also reports SQLite vs Chroma sync state)
- Chat: `POST /chat` with `{ "message": "...", "history": [], "user_id": "..." }`
- Chat streaming (primary): `POST /chat/stream` — SSE `token` events + one `done` payload
- Register: `POST /auth/register` with `{ "username": "...", "password": "...", "displayName": "..." }`
- Login: `POST /auth/login` with `{ "username": "...", "password": "..." }`
- Google Sign-In: `POST /auth/google` with `{ "idToken": "..." }` (needs `GOOGLE_CLIENT_IDS` in `.env`)
- Feedback: `POST /feedback` with `{ "message": "...", "answer": "...", "useful": true, "source_ids": [] }`
- Sync knowledge: `POST /sync-knowledge` (reload articles from SQLite after admin CRUD)
- An `OPENROUTER_API_KEY` is **required** for answers — without it the API replies that the AI service is not configured (no anonymous mode).
- Flow per question: greeting check → intent+NER → semantic retrieval (ChromaDB + cross-encoder re-rank) → answer grounded ONLY in retrieved knowledge; no strong match gets one clarification ask or an honest "haven't learned that yet"; non-farming questions are refused. See `docs/PROJECT_DOCUMENTATION.md`.

## 2. Mobile (Expo)

```bash
cd mobile
npm install
npx expo start        # or: npx expo run:ios / run:android for a dev build
```

Edit `mobile/src/config.ts` → `API_BASE_URL` if needed:

| Client | API URL |
|--------|---------|
| iOS Simulator / web (same Mac) | `http://127.0.0.1:8000` |
| Android Emulator | `http://10.0.2.2:8000` |
| Physical phone | `http://YOUR_LAN_IP:8000` |

Features: login/signup, Google Sign-In, guest mode, Myanmar + English i18n, light/dark theme, streaming chat responses, chat history, suggestion chips from the KB.

## 3. Admin Portal (Next.js)

```bash
cd web
npm install
npx prisma generate
npm run db:push       # create/sync web/dev.db schema
npm run db:seed       # base seed (optional)
npm run dev
```

Opens at `http://localhost:3000`. The portal sits behind a **demo login form** (client-side only):

| Username | Password |
|----------|----------|
| `admin` | `admin123` |
| `farmer` | `farmer123` |

Manages the knowledge base (articles), reviews feedback, and displays analytics. Article edits reach the bot via `POST /sync-knowledge` (or automatically via the backend's fingerprint check).

## 4. Data

- Source of truth: SQLite `web/dev.db` (`Article` table), managed by the portal.
- Seed curated content with `backend/seed_myanmar_agri.py` (25 Myanmar articles; insert-if-missing so admin edits survive).
- The legacy CSV in `data/` is no longer read by the backend.
- No knowledge match → one clarification follow-up or an honest "haven't learned that yet" reply. The answer LLM is never called without retrieved knowledge.

## Security

- Never commit `backend/.env`, `web/.env`, `web/dev.db`, or `backend/feedback.jsonl` (gitignored).
- Only commit `.env.example` files (no real keys).
- The portal login gate is a client-side demo (hardcoded creds), not server-side auth.
