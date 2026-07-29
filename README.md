# တောင်သူ့ရဲ့ခေါင် (FarmBot Myanmar)

Text-based farming NLP chatbot — Expo mobile app + FastAPI backend.

```
FarmBotMyanmar/
├── mobile/          # Expo (React Native) chat app
├── backend/         # FastAPI + retrieval + OpenRouter RAG
├── data/            # agriculture_qa.csv knowledge base
├── docs/            # NLP overview notes
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
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- Health: http://127.0.0.1:8000/health
- Chat: `POST /chat` with `{ "message": "...", "history": [] }`
- Without `OPENROUTER_API_KEY`, the API still answers using CSV retrieval.

## 2. Mobile (Expo)

```bash
cd mobile
npm install
npx expo start
```

Edit `mobile/src/config.ts` → `API_BASE_URL` if needed:

| Client | API URL |
|--------|---------|
| iOS Simulator / web (same Mac) | `http://127.0.0.1:8000` |
| Android Emulator | `http://10.0.2.2:8000` |
| Physical phone | `http://YOUR_LAN_IP:8000` |

## 3. Data

- Source CSV: `data/agriculture_qa.csv`
- Backend loads this for retrieval + RAG context.

## Security

- Never commit `backend/.env` (it is gitignored).
- Only commit `backend/.env.example` (no real keys).
