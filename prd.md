# PRD: FarmBot AI — တောင်သူ့ရဲ့ခေါင် (Taung Thu Ye Khaung)

## FarmBot AI: Myanmar Agricultural Question Answering, Knowledge Management, and Data Mining System

> **Status legend used throughout this document:**
> `Status: Built` — implemented and working today · `Status: Partial` — a basic version exists, full version planned · `Status: Future` — designed, not yet built.

---

## 1. Project Title

**FarmBot AI — Myanmar Agricultural Question Answering, Knowledge Management, and Data Mining System** (mobile app: **တောင်သူ့ရဲ့ခေါင် / Taung Thu Ye Khaung**)

---

## 2. Project Overview

FarmBot AI is an intelligent agricultural assistant designed to answer farmers' questions in the **Myanmar language**.

The system combines:

- **Natural Language Processing (NLP)**
- **Named Entity Recognition (NER)** — `Built`
- **Intent Classification**
- **Sentence Embeddings**
- **Semantic Vector Search**
- **Retrieval-Augmented Generation (RAG)**
- **Large Language Models (LLM)**
- **Data Mining** — `Future`
- **Data Analysis** — `Future`
- **Knowledge Base Management**

The system allows administrators to manage agricultural knowledge through a web portal. User questions, search results, and feedback are continuously collected and analyzed to discover agricultural information needs and improve the knowledge base.

---

## 3. Problem Statement

Farmers may ask the same agricultural question using many different expressions.

For example:

> "စပါးရွက်တွေ အညိုရောင်ဖြစ်နေတယ် ဘာလုပ်ရမလဲ"

and

> "စပါးမှာ အရွက်ညိုပြီး အစက်တွေဖြစ်နေတာ ဘာရောဂါလဲ"

may refer to similar agricultural knowledge.

Traditional keyword-overlap search cannot reliably understand these semantic similarities.

Additionally, a static CSV knowledge base makes it difficult for administrators to:

- Add new knowledge
- Update outdated information
- Review user feedback
- Identify knowledge gaps
- Analyze frequently asked questions

FarmBot addresses these problems using NLP, semantic retrieval, AI-generated answers, and data analytics.

---

## 4. Objectives

### 4.1 NLP Objectives

The system should:

1. Normalize Myanmar text. — `Partial`
2. Identify the user's intent. — `Built` (LLM classifier over the 10-intent taxonomy; keyword heuristics as offline fallback)
3. Extract important agricultural entities. — `Built` (LLM NER, lexicon fallback)
4. Convert questions into semantic embeddings. — `Built`
5. Retrieve semantically relevant knowledge. — `Built`

### 4.2 AI Objectives

The system should:

1. Use retrieved agricultural knowledge as context. — `Built`
2. Generate understandable answers. — `Built`
3. Avoid generating unsupported information. — `Built` (LLM is never called without a strong knowledge match)
4. Inform the user when sufficient knowledge is unavailable. — `Built` ("I haven't learned that yet" reply)

### 4.3 Data Mining Objectives

The system should: — `Future` (designed; Python/Pandas/Scikit-learn planned)

1. Analyze user questions.
2. Discover frequently discussed crops and diseases.
3. Identify common agricultural topics.
4. Analyze user feedback.
5. Discover knowledge gaps.
6. Identify relationships between crops, diseases, symptoms, and intents.
7. Provide analytical dashboards.

---

## 5. Target Users

### Farmer/User

Can: — `Built` (chat) / `Partial` (history saved on device)

- Ask agricultural questions
- Receive AI-generated answers
- View conversation history
- Submit feedback

### Administrator

Can: — `Built` (admin portal)

- Manage knowledge (CRUD articles via web portal)
- Review feedback (useful/not-useful filter, cited articles)
- Monitor chatbot performance (stats dashboard)
- View analytics (feedback trends, most-cited articles)
- Review AI-generated knowledge suggestions (Future)

---

## 6. System Architecture

```text
                         FARMER
                           │
                           ▼
                    User Question
                           │
                           ▼
                Myanmar Text Normalization
                           │
                           ▼
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
      Intent Classification            NER
              │                         │
              │                 ┌───────┴────────┐
              │                 │                │
              ▼                 ▼                ▼
          User Intent          Crop          Disease
                            Symptom           Pest
                              etc.
              │                 │
              └────────┬────────┘
                       ▼
                Query Embedding
                       │
                       ▼
                Semantic Search
                       │
                       ▼
                 Vector Database
                       │
                       ▼
              Top Relevant Knowledge
                       │
                       ▼
                     LLM
                       │
                       ▼
                  AI Answer
                       │
                       ▼
                    Feedback
                       │
                       ▼
               Data Collection
                       │
             ┌─────────┴─────────┐
             ▼                   ▼
        Data Analysis        Data Mining
             │                   │
             └─────────┬─────────┘
                       ▼
                Admin Dashboard
```

**What is implemented today vs. the full architecture:** today the pipeline runs *normalization → agriculture gate → intent + NER (LLM, structured JSON; heuristic fallback) → entity-built semantic search → knowledge → LLM → feedback → feedback.jsonl*. The answer LLM is **only called when the knowledge base contains a strong match**; otherwise the bot honestly replies that it has not learned the answer yet. Data Analysis, Data Mining, and the Admin Dashboard are designed but not yet built (see [Build Status](#build-status-matrix)).

---

## 7. NLP Module

### 7.1 Myanmar Text Normalization

The system preprocesses Myanmar text before further processing. — `Status: Partial`

Currently built (`backend/app/retrieval.py`):

- Tokenizer handling both Latin words and Myanmar script runs (`[a-z0-9\u1000-\u109f]+`).
- Lowercasing for embedding; stopword removal; `;`-separated list parsing.

Planned (`Status: Future`):

- Normalize Unicode (Zawgyi → Unicode).
- Normalize Myanmar orthographic variations and diacritics.
- Remove unnecessary characters; normalize spaces.
- Prepare text for tokenization/embedding.

```text
User Input
   ↓
Myanmar Text Normalization
   ↓
Normalized Question
```

---

## 8. Intent Classification

Intent classification determines:

> **"What does the farmer want to know?"**

`Status: Built` — the **LLM-driven classifier** labels the 10-intent taxonomy; the keyword-heuristic tagger (`guess_intent`) remains as the offline fallback.

### Current implementation (Built)

`backend/app/llm.py` — `extract_intent_ner()` (one structured JSON call) labels each
question as one of the target intents in §8 below. `backend/app/retrieval.py` —
`guess_intent()` tags questions with the same 10-intent taxonomy using keyword
heuristics when no LLM is configured:

| Intent (current) | Example signal |
| --- | --- |
| CULTIVATION | cultivate, plant, grow, seedling; စိုက် |
| DISEASE_IDENTIFICATION | disease, blast, blight, rust, spot, rot, fungus; ရောဂါ |
| DISEASE_TREATMENT | medicine, cure, treat, fungicide; ဆေး |
| PEST_CONTROL | pest, insect, borer, aphid, moth, worm; ပိုး |
| FERTILIZER | fertilizer, nitrogen, npk, nutrient, compost; မြေသြဇာ |
| WATER_MANAGEMENT | water, irrigate, irrigation, dry, wet; ရေ |
| HARVESTING | harvest, reaping; ရိတ် |
| PREVENTION | prevent, protect, avoid, spray; ကာကွယ် |
| GENERAL_INFORMATION | information, know |
| OTHER | (fallback) |

### Target intent taxonomy (Future)

Start with approximately 8–10 broad categories — do not create hundreds of intents.

| Intent | Example |
| --- | --- |
| GENERAL_INFORMATION | စပါးအကြောင်း သိချင်ပါတယ် |
| CULTIVATION | စပါးကို ဘယ်လိုစိုက်ရမလဲ |
| DISEASE_IDENTIFICATION | ဘာရောဂါဖြစ်တာလဲ |
| DISEASE_TREATMENT | ဘာဆေးသုံးရမလဲ |
| PEST_CONTROL | ပိုးကျရင် ဘာလုပ်ရမလဲ |
| FERTILIZER | ဘာမြေဩဇာသုံးရမလဲ |
| WATER_MANAGEMENT | ရေဘယ်လောက်ပေးရမလဲ |
| HARVESTING | ဘယ်အချိန်ရိတ်ရမလဲ |
| PREVENTION | ဘယ်လိုကာကွယ်ရမလဲ |
| OTHER | အခြား |

### Target approach (Built — LLM-driven)

One LLM call classifies the intent **and** extracts the entities as structured JSON (see [§10](#10-intent--ner-together)); the keyword tagger is the offline fallback. The structured result drives query building and (optionally) filters retrieval:

For:

> "စပါး blast ဖြစ်ရင် ဘာဆေးသုံးရမလဲ"

The system produces:

```json
{
  "intent": "DISEASE_TREATMENT",
  "entities": {
    "crop": "rice",
    "disease": "blast"
  }
}
```

---

## 9. Named Entity Recognition (NER)

NER determines:

> **"What agricultural things is the farmer talking about?"**

`Status: Built` — the LLM extracts entities in the same structured call as intent; a lexicon fallback (`extract_entities`) covers offline mode.

### Planned approach (Built — LLM-first)

- **Primary:** the **LLM extracts intent + NER together** in one structured call (see [§10](#10-intent--ner-together)) → JSON `{intent, crop, disease, pest, symptom, plant_part, location}`. The crop value is grounded to the knowledge base's crop list (with Myanmar name hints) to avoid hallucinated entities.
- **Fallback / offline:** lexicon/rule-based extraction (`extract_entities` — crop names from the KB, plus English dictionaries for disease/pest/symptom/plant-part).
- **Evaluation:** Precision / Recall / F1 against a labeled eval set is `Future` (see [Evaluation](#24-evaluation)).

### Initial Entity Types

```text
CROP
DISEASE
PEST
SYMPTOM
FERTILIZER
PESTICIDE
PLANT_PART
LOCATION
```

Example:

> "စပါးရွက်မှာ blast ဖြစ်ပြီး အညိုရောင်အစက်တွေ ဖြစ်နေတယ်"

NER output:

```text
စပါး       → CROP
ရွက်       → PLANT_PART
blast      → DISEASE
အညိုရောင်အစက် → SYMPTOM
```

Structured result:

```json
{
  "crop": "rice",
  "disease": "blast",
  "symptom": "brown spots",
  "plant_part": "leaf"
}
```

**Built approach:** the LLM extracts intent + entities in one structured JSON call (primary), with lexicon/rule-based extraction as an offline fallback; formal Precision / Recall / F1 evaluation is planned (see [Evaluation](#24-evaluation)).

---

## 10. Intent + NER Together

`Status: Built` — the NLP layer's structured stage.

Question:

> "စပါးရွက်မှာ blast ဖြစ်ရင် ဘာဆေးသုံးရမလဲ?"

### Intent

```text
DISEASE_TREATMENT
```

### Entities

```text
CROP = Rice
PLANT_PART = Leaf
DISEASE = Blast
```

Therefore the system understands:

```text
User wants:
Treatment

About:
Rice

Disease:
Blast
```

This information can then be used to (a) build the retrieval query (query + intent + entities), (b) filter retrieval (e.g. restrict to the detected crop), and (c) feed the analytics / data mining datasets — see the [target RAG pipeline](#14-rag-pipeline).

---

## 11. Embedding and Semantic Search

`Status: Built`

After NLP processing, the question is converted into a vector.

```text
Question
   ↓
Embedding Model
   ↓
[0.12, -0.42, 0.78, ...]
```

The vector is compared against knowledge vectors.

### Implementation (current)

- **Embedding model:** `intfloat/multilingual-e5-small` (Myanmar-capable), with `query:` / `passage:` prefixes.
- **Vector DB:** ChromaDB (persistent, `backend/chroma_store`).
- **Re-ranking / match decision:** cross-encoder `cross-encoder/mmarco-mMiniLMv2-L12-H384-v1` produces the relevance logit used for the "real match vs no match" decision.
- **Fallback:** weighted keyword retrieval (`retrieve`) when semantic search finds nothing convincing.

### Example (target behavior)

User:

> "စပါးရွက်တွေ အညိုရောင်ဖြစ်နေတယ် ဘာလုပ်ရမလဲ?"

Possible results:

```text
Rice Blast Disease       0.91
Rice Brown Spot          0.84
Bacterial Leaf Blight    0.76
Rice Sheath Blight       0.52
```

The system retrieves the most relevant knowledge.

---

## 12. Knowledge Base

The knowledge base should **not** force every article to contain disease-specific fields. Use a flexible structure. `Status: Built` (article form is live in `data/agriculture.csv`)

### Current structure (Built — flexible articles)

```text
Title *     Category *    Crop    Content *    Source    Tags
```

Implemented schema (one row per article):

```text
id | title | category | crop | content | source | tags | region | language | verified
```

| Field | Example |
| --- | --- |
| id | `rice-brown-spot` |
| title | `စပါးအညိုကွက်ရောဂါ` |
| category | `disease` |
| crop | `rice` |
| content | The full article text (symptoms, causes, solution) in Myanmar |
| source | `internal` |
| tags | `rice;disease` |
| region / language / verified | `general` / `my` / `true` |

An article might be:

```text
Title:
Rice Blast Disease

Category:
Disease

Crop:
Rice

Content:
Rice blast is a fungal disease...
Symptoms...
Treatment...
Prevention...
```

Another:

```text
Title:
How to Apply Fertilizer to Rice

Category:
Fertilizer

Crop:
Rice

Content:
...
```

> The previous rigid Q&A-card format (separate `question`, `answer`,
> `symptoms`, `possible_causes`, `solution` columns) was migrated into this
> article schema in `data/agriculture.csv` and `data/agriculture_qa.csv`.

---

## 13. Knowledge Embedding

Do not blindly embed every database field. `Status: Built`

### Current (Built)

`KnowledgeRecord.search_text()` (`backend/app/knowledge.py`) embeds exactly **Title + Content** — and nothing else. Metadata (Category, Crop, Tags, Source, Language, Region) is stored separately in the vector index (`backend/app/vectorstore.py`) so it can be used for filtering and analytics without polluting the semantic index.

For example, the embedded text for an article is:

```text
How to Grow Rice.

Rice should be planted in...
The soil should be prepared...
```

And the metadata (not embedded) stays:

```text
Category: Cultivation
Crop: Rice
Tags: rice, cultivation
Source: internal
```

---

## 14. RAG Pipeline

`Status: Built` — includes the LLM Intent + NER stage

### Pipeline (built — LLM-driven Intent + NER)

```text
USER
  │
  ▼
Question
  │
  ▼
Myanmar Normalization
  │
  ▼
  ┌──────────────┐
  │      LLM     │
  │              │
  │ Intent + NER │          ← one call returns structured JSON
  └──────┬───────┘
         │
 Structured result  {intent, crop, disease, pest, symptom, plant_part, location}
         │
         ▼
Query + Intent + Entities          ← entities used to build/filter the query
         │
         ▼
multilingual-e5-small              ← embedding (current: intfloat/multilingual-e5-small)
         │
         ▼
ChromaDB
         │
      Top 10/20
         │
         ▼
mmarco-mMiniLMv2-L12-H384          ← cross-encoder re-rank (current model)
         │
      Top 3–5
         │
         ▼
RAG Context
         │
         ▼
LLM
         │
         ▼
Answer
         │
         ▼
Feedback
         │
         ▼
Data Mining & Analysis
```

### Current implementation (Built)

The current implementation (`backend/app/rag.py`) runs: **agriculture gate** (LLM, keyword fallback) → **intent + NER stage** (one LLM structured call; lexicon fallback) → **entity-built query** → semantic search (optionally crop-filtered via Chroma metadata) → cross-encoder relevance check → keyword fallback → knowledge check → LLM grounded in the retrieved `CONTEXT`. If the knowledge base has **no strong match**, the answer LLM is **never called** and the bot replies "I haven't learned that yet." If no LLM key is configured (or the LLM fails), it degrades to a structured answer from the best-matching article. Entities are returned to the client (`entities`) and ready to feed the interaction/analytics datasets.

---

## 15. Knowledge Confidence / Retrieval Threshold

The system should not answer confidently when retrieval is poor. `Status: Built`

Example:

```text
Similarity Score = 0.91
```

→ sufficient knowledge → generate answer.

But:

```text
Similarity Score = 0.28
```

→ insufficient knowledge.

The system can respond:

> "ဒီမေးခွန်းအတွက် လုံလောက်တဲ့အချက်အလက်ကို Knowledge Base ထဲမှာ မတွေ့ရှိသေးပါ။"

This reduces hallucination.

### Implementation (current)

- `min_semantic_score` (cross-encoder relevance threshold, default `0.0`) and `min_retrieval_score` (keyword threshold) in `backend/app/config.py` decide "strong match vs no match".
- **No strong match** → the bot replies **"I haven't learned that yet"** (Myanmar), logs nothing fabricated, and does **not** call the LLM. This is the main anti-hallucination control.
- Out-of-scope questions are refused before any LLM call.
- With a match, the LLM is instructed to answer strictly from the retrieved `CONTEXT`.

---

## 16. Feedback System

`Status: Partial` — basic thumbs-up/down is built; richer fields are `Future`.

After an answer:

```text
Was this answer helpful?

👍 Yes

👎 No
```

Optional (`Future`):

```text
Reason:
[ Wrong information ]

Comment:
[ ... ]
```

### Current implementation (Built)

`POST /feedback` appends JSON-lines to `backend/feedback.jsonl`:

```text
feedback_id      (derived from timestamp)
conversation_id  (Future)
question / message   ✓ stored
answer               ✓ stored
rating / useful      ✓ stored
source_ids           ✓ stored
reason               Future
comment              Future
timestamp            ✓ stored
```

---

## 17. Dynamic Dataset

Your system automatically generates datasets from actual usage. `Status: Partial` — feedback dataset exists; interaction dataset is `Future`.

### Interaction Dataset (`Future` — entities/intent already captured per question in the API response)

```text
question
timestamp
intent
crop
disease
symptom
retrieved_documents
similarity_score
answer
response_time
```

### Feedback Dataset (`Built` in basic form — `feedback.jsonl`)

```text
question
intent
answer
rating
reason
comment
timestamp
```

This dataset grows automatically as FarmBot is used.

---

## 18. Data Analysis

`Status: Future` — designed; Python (Pandas/Matplotlib) + Admin Portal planned.

The administrator dashboard should show:

### User Activity

- Daily questions
- Weekly questions
- Monthly questions
- Active users

### Agricultural Topics

- Most requested crops
- Most requested diseases
- Most requested pests
- Most requested fertilizers

### Intent Distribution

Example:

```text
Disease          40%
Treatment        25%
Cultivation      15%
Fertilizer       10%
Other            10%
```

### Feedback

```text
Positive: 87%
Negative: 13%
```

---

## 19. Data Mining

`Status: Future` — this is where the project satisfies the **Data Mining** requirement. Planned with Python + Pandas + NumPy + Scikit-learn + Matplotlib.

### 19.1 Clustering

Group similar farmer questions.

For example:

```text
Cluster 1  Rice Disease Questions
Cluster 2  Fertilizer Questions
Cluster 3  Pest Questions
Cluster 4  Cultivation Questions
```

Possible algorithm: **K-Means clustering** (on question embeddings).

### 19.2 Classification

Use historical data to classify:

```text
Question → Intent
```

Initially: the LLM-driven intent classifier (structured JSON). Later, with enough labeled data, train an ML classifier and compare performance (Accuracy / Precision / Recall / F1).

### 19.3 Association Analysis

Discover relationships between agricultural entities.

Example:

```text
Rice + Brown Spots + High Humidity
        ↓
Frequently associated with
        ↓
Rice Blast
```

Possible algorithm: **Apriori**.

### 19.4 Trend Analysis

Analyze changes over time.

Example:

```text
June      Rice Disease Questions: 120
July      Rice Disease Questions: 190
August    Rice Disease Questions: 280
```

The administrator can identify increasing agricultural concerns.

---

## 20. Knowledge Gap Detection

One of the most useful features. `Status: Future`

```text
User Questions
       ↓
Vector Search
       ↓
Low Similarity Results
       ↓
Repeated Questions
       ↓
Knowledge Gap
```

Example:

```text
Question:
"How do I treat bacterial wilt?"

Similarity:
0.31

Asked:
47 times
```

Dashboard:

> **Knowledge Gap Detected**

```text
Topic:
Bacterial Wilt

Questions:
47

Recommended Action:
Add knowledge article
```

---

## 21. AI-Assisted Knowledge Improvement

AI should **suggest**, not automatically modify important agricultural knowledge. `Status: Future`

```text
Negative Feedback
        ↓
AI Analysis
        ↓
Suggested Knowledge Update
        ↓
Administrator Review
        ↓
Approve
        ↓
Knowledge Base
        ↓
Generate New Embedding
```

This provides human oversight.

---

## 22. Admin Portal

`Status: Built` — Next.js 16 + Tailwind CSS v4 + Prisma 7 + SQLite (`web/`).

### Dashboard

```text
Total Questions      12,540
Knowledge Articles   438
Positive Feedback    89%
Knowledge Gaps       17
```

### Pages (Built)

```text
Dashboard            /
Knowledge Base       /knowledge
 ├── Add             /knowledge/new
 ├── Edit            /knowledge/[id]
 ├── Delete          (via API)
 └── Search/Filter   (client-side)

Feedback             /feedback
 ├── Positive
 └── Negative

Analytics            /analytics
 ├── Feedback trends
 └── Most-cited articles
```

### Remaining (Future)

```text
Data Mining          (clustering, association rules, trends)
Knowledge Suggestions
Intent analytics     (needs QuestionLog data from backend)
```

---

## 23. Technology Stack

The backend keeps the **current stack** (no rewrite to ASP.NET/Node).

### Current (Built)

| Layer | Technology |
| --- | --- |
| Mobile Application | React Native (Expo) — `mobile/` |
| Admin Portal | Next.js 16 + Tailwind CSS v4 + Prisma 7 + SQLite — `web/` |
| API Backend | FastAPI (Python) + Uvicorn — `backend/` |
| Database | SQLite (`web/dev.db`) via Prisma 7 + built-in `sqlite3`; CSV knowledge base (`data/agriculture.csv`); JSONL feedback backup (`feedback.jsonl`) |
| Vector Database | ChromaDB (persistent, `backend/chroma_store`) |
| Embeddings | `sentence-transformers` — `multilingual-e5-small` |
| Re-ranking | `cross-encoder/mmarco-mMiniLMv2-L12-H384-v1` |
| LLM | OpenRouter — `openai/gpt-4o-mini` (configurable) |
| Auth | SHA-256 password hashing, SQLite `User` table |
| i18n | English + Myanmar (`mobile/src/i18n/`) |
| Theme | Light/dark mode (`mobile/src/theme.ts`) |

### Planned (Future)

| Layer | Technology |
| --- | --- |
| NER + Intent | LLM-driven extraction (one structured JSON call); lexicon/rule-based fallback for offline mode |
| Data Mining / Analysis | Python — Pandas, NumPy, Scikit-learn, Matplotlib |
| Database (optional) | PostgreSQL / MySQL when KB outgrows CSV |

**Rationale:** the current Python + ChromaDB + sentence-transformers stack already implements the NLP/semantic core; the Data Mining/Analysis layer is also Python-native, so we extend the same stack rather than changing languages.

---

## 24. Evaluation

The project should not only say **"the chatbot works."** Measure each component. `Status: Partial` — metrics defined; formal eval sets are `Future`.

### Intent Classification

```text
Accuracy
Precision
Recall
F1-score
```

### NER

```text
Precision
Recall
F1-score
```

### Retrieval

Measure:

```text
Top-1 accuracy
Top-3 accuracy
Top-5 accuracy
```

### RAG Answer

Evaluate:

```text
Answer relevance
Answer correctness
Faithfulness to KB
User feedback
```

### Data Mining

Evaluate whether discovered clusters/rules are meaningful and useful.

---

## 25. Final End-to-End System

```text
                    FARMER
                       │
                       ▼
                 Ask Question
                       │
                       ▼
            Myanmar Normalization
                       │
                       ▼
             ┌─────────┴─────────┐
             │                   │
             ▼                   ▼
       Intent Classification     NER
             │                   │
             ▼                   ▼
        User Intent        Crop/Disease/
                           Symptom/Pest
             │                   │
             └─────────┬─────────┘
                       ▼
                Query Embedding
                       │
                       ▼
                 Vector Search
                       │
                       ▼
              Relevant KB Chunks
                       │
                       ▼
                  RAG Context
                       │
                       ▼
                      LLM
                       │
                       ▼
                   AI Answer
                       │
                 ┌─────┴─────┐
                 ▼           ▼
              Helpful?     Not Helpful?
                 │           │
                 └─────┬─────┘
                       ▼
                 Feedback DB
                       │
                       ▼
              Data Analysis
                       │
                       ▼
                Data Mining
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
      Clustering   Association    Trends
          │            │            │
          └────────────┼────────────┘
                       ▼
                Admin Dashboard
                       │
                       ▼
              Knowledge Improvement
```

### The key idea for this project

Four different jobs, each technology with a clear reason to exist:

| Component | Job | Status |
| --- | --- | --- |
| **NER** | Find *what* the farmer is talking about | Built |
| **Intent Classification** | Find *what the farmer wants* | Built (LLM + heuristic fallback) |
| **Embeddings + Vector Search** | Find *which knowledge is semantically relevant* | Built |
| **LLM** | Turn the retrieved knowledge into a natural answer | Built |
| **Data Mining** | Discover patterns from actual FarmBot usage | Future |
| **Data Analysis** | Explain and visualize those patterns | Future |
| **Knowledge Portal** | Let humans maintain the source of truth | Built (Next.js + SQLite — `web/`) |

This separation matters for the thesis/presentation: **AI is not used just because it is available; each component solves a specific problem.**

---

## Build Status Matrix

| Component | Status | Where |
| --- | --- | --- |
| Myanmar chat (mobile UI + history) | Built | `mobile/` |
| Mobile auth (register / login / guest) | Built | `mobile/src/hooks/useAuth.tsx` + `backend/app/database.py` |
| Mobile i18n (English + Myanmar) | Built | `mobile/src/i18n/` |
| Mobile theme (light/dark) | Built | `mobile/src/theme.ts` |
| Myanmar text tokenization / lowercase | Built | `backend/app/retrieval.py` |
| Full Myanmar normalization (Zawgyi→Unicode) | Future | — |
| Sentence embeddings (e5-small) | Built | `backend/app/vectorstore.py` |
| Semantic search (ChromaDB) + cross-encoder re-rank | Built | `backend/app/vectorstore.py` |
| Keyword retrieval fallback | Built | `backend/app/retrieval.py` |
| Farming gate / out-of-scope refusal | Built | `backend/app/llm.py` + `rag.py` |
| Intent classification (10-intent LLM classifier + heuristic fallback) | Built | `backend/app/llm.py` + `retrieval.py` |
| NER via LLM (CROP/DISEASE/PEST/SYMPTOM/...) + lexicon fallback | Built | `backend/app/llm.py` + `retrieval.py` |
| Entity-built retrieval query + optional crop filter | Built | `backend/app/rag.py` + `vectorstore.py` |
| "I haven't learned that yet" no-knowledge reply | Built | `backend/app/rag.py` |
| RAG LLM generation (OpenRouter, grounded only) | Built | `backend/app/llm.py` + `rag.py` |
| Retrieval confidence threshold | Built | `backend/app/config.py` |
| Flexible KB article structure (Title/Category/Crop/Content/Source/Tags) | Built | `data/agriculture.csv` + `knowledge.py` |
| Embedding = Title + Content (metadata separate) | Built | `knowledge.py` + `vectorstore.py` |
| Index auto-rebuild on content edits (fingerprint) | Built | `backend/app/vectorstore.py` |
| Knowledge sync (SQLite → vector index rebuild) | Built | `backend/app/sqlite_loader.py` + `POST /sync-knowledge` |
| LLM article classification (auto-suggest categories/crops/tags) | Built | `backend/app/classify.py` |
| Feedback (thumbs up/down + source ids) | Built | `backend/app/main.py` → SQLite + `feedback.jsonl` |
| Chat logging (intent, entities, response time) | Built | `backend/app/database.py` → `QuestionLog` |
| Admin Portal — Dashboard | Built | `web/src/app/page.tsx` |
| Admin Portal — Knowledge Base CRUD | Built | `web/src/app/knowledge/` |
| Admin Portal — Feedback review | Built | `web/src/app/feedback/` |
| Admin Portal — Analytics | Built | `web/src/app/analytics/` |
| Feedback reason/comment fields | Future | — |
| Interaction dataset (full) | Future | — |
| Data Analysis dashboard (full) | Future | — |
| Data Mining (clustering / association / trends) | Future | — |
| Knowledge Gap Detection | Future | — |
| AI-assisted KB improvement (suggest→approve) | Future | — |
| Admin Portal — Data Mining views | Future | — |
| Admin Portal — Knowledge Suggestions | Future | — |
| Evaluation sets (intent/NER/retrieval/RAG) | Future | — |

---

## Roadmap

### Phase 0 — Foundation (done)
- Expo chat app; FastAPI backend; OpenRouter RAG; flexible article knowledge base (Title/Category/Crop/Content/Source/Tags); ChromaDB semantic search over Title+Content; honest "haven't learned that yet" no-match reply; feedback collection.

### Phase 1 — Stronger NLP (mostly done)
1. Explicit **text normalization** module (Zawgyi→Unicode, diacritics, spacing). — `Future`
2. Upgrade **intent classification** to the 10-intent taxonomy. — **Done** (`llm.py` `extract_intent_ner`; `retrieval.py` `guess_intent` fallback)
3. **NER + intent** module — LLM-driven extraction (one structured JSON call); lexicon/rule-based fallback for offline mode. — **Done**
4. Build the **interaction dataset** (log intent, entities, similarity scores, response time per question). — `Future` (entities already returned in the API)
5. Build **evaluation sets** and report §24 metrics. — `Future`

### Phase 2 — Data Mining & Analysis
6. Question/feedback analytics with Pandas (volume, crops, diseases, intents, satisfaction).
7. Clustering (K-Means on embeddings), Association (Apriori), Trend analysis.
8. **Knowledge Gap Detection** dashboard.

### Phase 3 — Admin Portal & Knowledge Management
9. Next.js + Tailwind admin portal (Dashboard, Knowledge Base CRUD, Feedback, Analytics). — **Done** (`web/`)
10. Manage the KB through the portal instead of editing the CSV by hand (articles → SQLite via Prisma). — **Done**
11. Data Mining views, Knowledge Suggestions, intent analytics (needs QuestionLog data from backend). — `Future`

---

*Generated PRD. Status markers reflect the current repository state; `Future` items are designed but not implemented. See `docs/PROJECT_DOCUMENTATION.md` for code-truthful implementation detail.*
