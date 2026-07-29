# PRD: တောင်သူ့ရဲ့ခေါင် (Taung Thu Ye Khaung)

## Project Overview

"တောင်သူ့ရဲ့ခေါင်" is a **text-based agricultural NLP chatbot** mobile app for Myanmar farmers. Farmers type farming questions and receive AI-generated advice as text — like an LLM chat assistant grounded in agricultural knowledge.

**MVP language:** English (via OpenRouter LLMs)  
**Target language (later):** Burmese (Myanmar)  
**Interaction model (MVP):** Text in → Text out (no voice)

The system is an NLP Question Answering (QA) pipeline: understand the question, retrieve farming knowledge, generate a grounded answer with an LLM. Voice (STT/TTS) is optional later and is not required for the NLP core.

**Why NLP (even with an LLM):** The LLM is the language engine, but the project still needs NLP techniques — retrieval, semantic search, intent/entity understanding, dialogue context, evaluation, and (later) Myanmar text processing. The LLM alone does not replace curated domain knowledge or safety checks.

---

## Goals

### Product goal
Create an accessible AI farming assistant that lets farmers get agricultural advice through natural language chat without technical knowledge.

### MVP goal
Ship a working React Native (Expo) app where a user can:
1. Type an English farming question in a chat UI
2. Get a grounded text answer from OpenRouter + agricultural knowledge (RAG)
3. See intent/crop tags and a structured answer when available
4. Give simple feedback (useful / not useful)

### NLP learning goal
Demonstrate end-to-end NLP QA: text understanding, information retrieval, RAG, evaluation, and a path to low-resource Myanmar NLP.

---

## Core User Flow (MVP)

1. User opens the React Native app.
2. User sees a **chat interface** (text-based LLM bot).
3. User types a farming question in **English**.
4. App sends the question to the backend.
5. Backend retrieves relevant agricultural knowledge (RAG / semantic search).
6. Backend optionally detects intent + crop/entities (LLM prompting or light classifier).
7. Backend calls an **OpenRouter** model with retrieved context to generate a simple farming recommendation.
8. App shows the text answer (structured format + optional source citation).
9. User can send a follow-up message (short conversation history) or rate the answer.

### Future flow (Myanmar)
Same chat pipeline with Myanmar text normalization/tokenization, Burmese RAG corpus, and Burmese answers. Voice STT/TTS may be added after the text NLP pipeline is solid.

---

## Main Features

### MVP (must ship)

#### 1. Text chat input / output
- Type questions, read text answers
- Chat history in the session (last N turns)

#### 2. RAG-grounded AI responses (OpenRouter)
- Retrieve farming knowledge before generation
- Prefer retrieval-grounded answers over free hallucination
- Structured answer format:
  - Possible cause
  - Solution / steps
  - When to ask a local agriculture officer
- Refuse politely when out of scope or knowledge is weak (“I don’t know”)

#### 3. Knowledge retrieval
- Search curated agriculture Q&A / symptom cards
- Start with keyword or simple match; upgrade to embeddings + semantic search
- Rank by relevance and pass top chunks to the LLM

#### 4. Basic question understanding
- Intent tags via LLM prompting: plant disease, pest, fertilizer, watering, technique, other
- Entity hints: crop, symptom (via prompting)
- Show tags above the answer (e.g. `rice · nutrient_deficiency`)

#### 5. Safety & disclaimer
- UI disclaimer: advice is not a substitute for local extension officers
- No invented pesticide dosages without trusted sources

#### 6. Answer feedback
- 👍 Useful / 👎 Not useful
- Store feedback for evaluation and dataset improvement

### Improvement features (after MVP)

| Feature | NLP value | Priority |
| --- | --- | --- |
| Embeddings + semantic search | High | P1 |
| Stronger intent / NER display | High | P1 |
| Source citation (`knowledge id`) | High | P1 |
| Suggested starter questions | Medium | P2 |
| Crop filter chips (rice, tomato…) | Medium | P2 |
| Eval set + weekly review | High | P1 |
| Myanmar parallel Q&A data | High | P2 |
| Myanmar normalization / tokenization | High | P3 |
| Voice STT/TTS (optional) | Medium (UX) | P4 |
| Robot animation | Low (UX only) | Optional |

### Explicitly deferred
- Voice input/output in MVP
- Full robot listening/speaking states as core requirement
- Custom trained Myanmar NER/intent models (unless time allows)

---

## NLP / AI Architecture

### MVP (English text chatbot + OpenRouter)
| Layer | Approach |
| --- | --- |
| Input | Typed English text |
| Understanding | OpenRouter LLM + system prompt (intent / entities) |
| Knowledge | CSV/JSON corpus → (later) embeddings + vector store + RAG |
| Generation | OpenRouter chat model (configurable) |
| Output | Structured English text answer |
| Context | Short conversation history (last N turns) |
| Feedback | Thumbs up/down logged per answer |

### Later (Myanmar + optional voice)
- Myanmar text normalization
- Tokenization
- Intent classification
- Named Entity Recognition (crop, disease, symptom)
- Myanmar sentence embeddings + semantic search
- Conversation context management
- Optional: Burmese STT / TTS

**OpenRouter notes**
- Keep the model name configurable (env / remote config), not hard-coded.
- Store API keys only on the backend — never in the mobile app.
- Log prompt tokens, latency, and cost per request.
- Use a low temperature for factual farming advice.
- Always pass retrieved knowledge into the prompt; ask the model to say “I don’t know / seek local expert” when context is weak.

### Why NLP is still required with an LLM
| NLP part | Role |
| --- | --- |
| RAG / semantic search | LLM does not automatically know your curated farming dataset |
| Intent / entity tags | Makes understanding visible and measurable |
| Dialogue context | Follow-up questions need history |
| Evaluation + feedback | Measures quality; improves data |
| Myanmar NLP (later) | Low-resource language processing beyond English LLM defaults |
| Safety rules | Domain constraints the raw model may ignore |

---

## Suggested Tech Stack

### Mobile
- **React Native** (Expo)
- Chat UI (message list + text input)
- Optional later: Rive/Lottie robot as a visual companion only

### Backend
- Python FastAPI
- OpenRouter API for LLM inference
- Embeddings: OpenRouter embedding model **or** sentence-transformers on the server
- Vector DB: Chroma / Qdrant / pgvector (Chroma is enough for prototype)

### Knowledge
- CSV / JSON farming Q&A → chunk → embed → vector index
- Source of truth: `data/agriculture_qa.csv` (synced into app/backend as needed)

### Speech (Phase 4 only — optional)
- STT / TTS after text NLP QA is stable

---

## Datasets & Knowledge Base

Datasets are the product’s “truth.” The LLM explains and adapts; the knowledge base supplies facts.

### What to collect for MVP (English)
1. **Q&A pairs** — question, answer, crop, topic (disease / pest / fertilizer / water / technique)
2. **Symptom → cause → solution** cards
3. **Crop profiles** — common crops, growth stages, basic care
4. **Safety rules** — pesticide warnings, “when to call an extension officer”

Suggested starter schema (JSON/CSV):

```json
{
  "id": "rice-leaf-yellow-n-deficiency",
  "crop": "rice",
  "topic": "nutrient_deficiency",
  "symptoms": ["yellow leaves", "pale older leaves"],
  "possible_causes": ["nitrogen deficiency"],
  "solution": "Check fertilizer schedule; apply nitrogen as locally recommended.",
  "region": "general",
  "source": "internal",
  "language": "en",
  "verified": true,
  "question": "Why are my rice leaves turning yellow?",
  "answer": "Yellow rice leaves often mean nitrogen deficiency..."
}
```

### Where data can come from
| Source | Use | Caution |
| --- | --- | --- |
| Your own curated Q&A | Best for MVP quality | Takes time; start with 50–200 solid entries |
| Public agri guides / FAO / extension PDFs | Good for RAG chunks | License, accuracy, region mismatch |
| University / NGO Myanmar agri materials | Best for later Burmese | May need permission + translation |
| Synthetic Q&A from LLM | Bootstrap coverage | Must be human-reviewed; mark as unverified |
| Farmer interviews / in-app feedback | Real questions farmers ask | Privacy consent |

### Dataset phases
1. **Bootstrap:** 25–100 English Q&A / symptom cards (rice + a few vegetables first).
2. **RAG corpus:** Chunk longer guides into 200–500 token pieces with crop/topic metadata.
3. **Eval set:** Hold out 20–50 questions with “gold” answers for quality checks.
4. **Myanmar later:** Parallel Burmese fields or separate `language: my` documents.
5. **Feedback loop:** Use 👎 answers to fix knowledge gaps.

### Quality rules
- Prefer **local / regional** advice when possible; label region if known.
- Never invent pesticide dosages without a trusted source.
- Store `source` and `verified` on every record.
- Separate **verified** vs **draft** content.

---

## Example Interactions

### MVP (English chat)
User: "My rice leaves are turning yellow. What could be wrong?"

Tags: `rice · nutrient_deficiency`  
Source: `rice-leaf-yellow-n-deficiency`

AI:
- **Possible cause:** Nitrogen deficiency (especially if older leaves turn pale first).
- **What to do:** Check fertilizer schedule and soil condition; apply nitrogen as locally recommended.
- **Ask an officer if:** Damage spreads quickly or you are unsure before applying chemicals.

### Out of scope
User: "Who won the football match yesterday?"

AI: "I can only help with farming questions. Please ask about crops, pests, fertilizer, or watering."

### Target (Burmese chat — later)
User: "စပါးရွက်ဝါနေတာ ဘာဖြစ်လဲ"

AI: "စပါးရွက်ဝါခြင်းသည် နိုက်ထရိုဂျင်ဓာတ်ချို့တဲ့မှု ဖြစ်နိုင်ပါတယ်။ မြေဩဇာအသုံးပြုမှုကို စစ်ဆေးပေးပါ။"

---

## Non-Goals (MVP)
- Voice STT/TTS as a required feature
- Robot animation as a required feature
- Custom trained Myanmar NER/intent models
- Offline-first full LLM on device
- Medical/livestock diagnosis beyond basic plant advice (unless dataset covers it)
- Marketplace, payments, or social features
- Covering “all farming” — start with a narrow crop scope

---

## Success Metrics (MVP)
- Time from question → text answer under ~5–10s on good network
- ≥70% of eval-set answers judged “useful and safe” by a human reviewer
- Retrieval finds a relevant chunk for ≥80% of in-scope farming questions
- Out-of-scope questions are refused cleanly (no farming advice invented)
- App handles empty input and network errors without crashing
- Feedback capture works (thumbs up/down logged)

---

## Risks & Mitigations
| Risk | Mitigation |
| --- | --- |
| LLM hallucinates harmful agri advice | RAG + “refuse if unsure” + verified dataset |
| OpenRouter cost / rate limits | Cache frequent Qs; smaller model; log usage |
| English-only MVP not useful for target users | Use MVP to prove NLP pipeline; plan Burmese data early |
| Weak keyword search misses similar questions | Upgrade to embeddings + semantic search |
| Wrong region advice | Metadata filters; disclaimer in UI |
| Scope creep (voice, robot, too many crops) | Stick to text chat + RAG first |

---

## What to Decide Before Starting Code

1. **Expo chat UI layout** — message list + input bar (no voice controls in MVP).
2. **OpenRouter model(s)** — cheap default; API key only on backend.
3. **Backend hosting** — where FastAPI will run.
4. **Vector DB choice** — Chroma locally for prototype is enough.
5. **Initial crop scope** — e.g. rice + 2–3 vegetables only.
6. **Disclaimer copy** — AI advice is not a substitute for local extension officers.
7. **Feedback storage** — local log first, then backend.
8. **Eval process** — who reviews answers (you / agronomist / teacher criteria).
9. **Burmese roadmap** — keep `language` field in every knowledge record.
10. **Voice / robot** — explicitly Phase 4 / optional, not blocking MVP.

---

## Suggested Build Order

### Phase 1 — Text NLP chatbot MVP
1. React Native chat UI (type → show reply)
2. FastAPI → OpenRouter (prompt-only answers)
3. Wire CSV/JSON knowledge + basic retrieval + RAG
4. Structured answers + “I don’t know” / out-of-scope handling
5. Intent/crop tags + disclaimer

### Phase 2 — Stronger NLP
6. Embeddings + semantic search (vector DB)
7. Conversation history (follow-ups)
8. Source citation + feedback buttons
9. Eval set + logging (latency, retrieval hit, feedback)

### Phase 3 — Myanmar NLP
10. Burmese Q&A data (`language: my`)
11. Myanmar text preprocessing as needed
12. Same chat UI, Burmese answers

### Phase 4 — Optional UX
13. Voice STT/TTS
14. Robot visual companion (if desired)

---

## Project Goal (summary)

Build a reliable **text → retrieve → OpenRouter answer** farming chatbot on React Native, backed by a curated agricultural dataset and clear NLP evaluation — then extend to Burmese, and only later add voice if needed.
