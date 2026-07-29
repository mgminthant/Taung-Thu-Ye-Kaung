# တောင်သူ့ရဲ့ခေါင် (Taung Thu Ye Khaung)

## သဘာဝဘာသာစကား လုပ်ငန်းစဉ် (NLP) အခြေခံ အကျဉ်းချုပ်

**ပရောဂျက် အမျိုးအစား:** သဘာဝဘာသာစကား လုပ်ငန်းစဉ် (NLP) + စကားပြော AI + ဗဟုသုတ ရှာဖွေမှု (Information Retrieval)  
**ပစ်မှတ် အသုံးပြုသူ:** မြန်မာ တောင်သူများ  
**လက်ရှိ ဖွံ့ဖြိုးမှု အဆင့် (MVP):** အင်္ဂလိပ်ဘာသာ + OpenRouter LLM  
**နောက်ပိုင်း ရည်မှန်းချက်:** မြန်မာဘာသာ NLP (STT, TTS, Intent, NER, RAG)

---

## ၁။ ပရောဂျက် အကျဉ်းချုပ်

**တောင်သူ့ရဲ့ခေါင်** သည် မြန်မာ တောင်သူများအတွက် အသံနှင့် မေးမြန်းနိုင်သော စိုက်ပျိုးရေး AI လက်ထောက်မိုဘိုင်းအက်ပ်ဖြစ်သည်။ တောင်သူသည် စိုက်ပျိုးရေးဆိုင်ရာ မေးခွန်းများကို **အသံ (voice)** ဖြင့် မေးပြီး၊ စနစ်သည် **စာသား** နှင့် **အသံ** နှစ်မျိုးလုံးဖြင့် အကြံပြုချက်များ ပြန်ပေးသည်။

ဤပရောဂျက်သည် NLP သင်ခန်းစာတွင် လေ့လာရသော အဓိက အကြောင်းအရာများကို ပေါင်းစပ်အသုံးပြုထားသည်—

| NLP အကြောင်းအရာ                      | ပရောဂျက်တွင် အသုံးချပုံ                           |
| ------------------------------------ | ------------------------------------------------- |
| Speech-to-Text (STT)                 | တောင်သူ၏ အသံကို စာသားသို့ ပြောင်းခြင်း            |
| Text Preprocessing                   | စာသား သန့်စင်ခြင်း၊ မြန်မာစာ normalization        |
| Tokenization                         | စာလုံးခွဲခြင်း                                    |
| Intent Classification                | မေးခွန်း ရည်ရွယ်ချက် ခွဲခြားခြင်း                 |
| Named Entity Recognition (NER)       | သီးနှံ၊ ရောဂါ၊ လက္ခဏာ ထုတ်ယူခြင်း                 |
| Sentence Embeddings                  | မေးခွန်းနှင့် ဗဟုသုတကို ဂဏန်းဗေဒသို့ ပြောင်းခြင်း |
| Semantic Search                      | အဓိပ္ပာယ်တူညီမှု အခြေပြု ရှာဖွေမှု                |
| RAG (Retrieval-Augmented Generation) | ဗဟုသုတ ရှာပြီး LLM ဖြင့် အဖြေထုတ်ခြင်း            |
| Text-to-Speech (TTS)                 | အဖြေကို အသံသို့ ပြောင်းခြင်း                      |
| Dialogue / Context Management        | စကားပြောဆိုမှု အကြောင်းအရာ ထိန်းသိမ်းခြင်း        |

---

## ၂။ NLP ပြဿနာ အနေနဲ့ ကြည့်ခြင်း

### ၂.၁ ပြဿနာ ဖော်ပြချက် (Problem Statement)

တောင်သူများသည် စိုက်ပျိုးရေးဆိုင်ရာ ပြဿနာများကို **သဘာဝဘာသာစကား** (မြန်မာ) ဖြင့် မေးမြန်းလိုကြသော်လည်း—

- စိုက်ပျိုးရေး ဗဟုသုတသည် စာအုပ်၊ PDF၊ အင်တာနက်တွင် ဖြန့်ဖြူးထားပြီး ရှာဖွေရ ခက်ခဲသည်
- Keyword ရှာဖွေမှု (စာလုံးတိုက်ရိုက် ရှာခြင်း) သည် အဓိပ္ပာယ်တူညီသော မေးခွန်းများကို မဖမ်းနိုင်ပါ
- တောင်သူအများစုသည် နည်းပညာ သိရှိမှု နည်းပါးသောကြောင့် ရှုပ်ထွေးသော အင်တာဖေ့စ် မသင့်လျော်ပါ

ထို့ကြောင့် ဤစနစ်သည် **အသံ → စာသား → အဓိပ္ပာယ် နားလည်ခြင်း → ဗဟုသုတ ရှာဖွေခြင်း → အဖြေ ထုတ်ပေးခြင်း → အသံ** ဟူသော NLP pipeline တစ်ခုလုံးကို လိုအပ်သည်။

### ၂.၂ NLP လုပ်ဆောင်ချက် အမျိုးအစား

ဤပရောဂျက်သည် NLP ၏ အောက်ပါ အမျိုးအစားများကို လက်တွေ့ကျကျ ပေါင်းစပ်သည်—

1. **Spoken Language Understanding (SLU)** — အသံမှ ရရှိသော စာသားကို နားလည်ခြင်း
2. **Question Answering (QA)** — မေးခွန်းနှင့် ကိုက်ညီသော အဖြေ ထုတ်ပေးခြင်း
3. **Information Retrieval (IR)** — ဗဟုသုတ အခြေခံတွင် သက်ဆိုင်ရာ အချက်အလက် ရှာဖွေခြင်း
4. **Text Generation** — LLM ဖြင့် လက်တွေ့ကျသော အကြံပြုချက် ဖန်တီးခြင်း
5. **Low-resource NLP** — မြန်မာဘာသာအတွက် အရင်းအမြစ် နည်းပါးသော စာသား လုပ်ငန်းစဉ် (နောက်ပိုင်း အဓိက စိန်ခေါ်မှု)

---

## ၃။ NLP Pipeline အဆင့်ဆင့် ဖော်ပြချက်

### ၃.၁ စနစ် အလုပ်လုပ်ပုံ (အဆင့်မြင့်)

```
တောင်သူ အသံ မေးခွန်း
        ↓
   [Speech-to-Text]
        ↓
   စာသား (Text)
        ↓
   [Text Preprocessing]
   (normalization, cleaning)
        ↓
   [Tokenization]
        ↓
   ┌─────────────────────────────────┐
   │  Question Understanding       │
   │  - Intent Classification      │
   │  - Named Entity Recognition   │
   │  - Sentence Embedding         │
   └─────────────────────────────────┘
        ↓
   [Semantic Search / Vector Retrieval]
   (ဗဟုသုတ အခြေခံတွင် သက်ဆိုင်ရာ အချက်အလက် ရှာဖွေခြင်း)
        ↓
   [RAG + LLM Generation]
   (OpenRouter Model)
        ↓
   အဖြေ စာသား
        ↓
   [Text-to-Speech]
        ↓
   တောင်သူ ထံ အသံ အဖြေ
```

### ၃.၂ အဆင့်တိုင်း အသေးစိတ်

#### အဆင့် ၁ — Speech-to-Text (STT)

- **လုပ်ဆောင်ချက်:** အသံကို ကွန်ပျူတာ နားလည်နိုင်သော စာသားသို့ ပြောင်းခြင်း
- **MVP:** အင်္ဂလိပ်ဘာသာ STT (Device STT သို့မဟုတ် Whisper API)
- **နောက်ပိုင်း:** မြန်မာဘာသာ STT (မြန်မာစကားပြော အသံအတွက် မော်ဒယ် လိုအပ်)

#### အဆင့် ၂ — Text Preprocessing (စာသား ကြိုတင်ပြင်ဆင်ခြင်း)

စာသား လုပ်ငန်းစဉ် မစခင် စာသားကို သန့်စင်ရသည်။

- အပိုနေရာများ ဖယ်ရှားခြင်း
- စာလုံးအကြီး/အသေး ပုံမှန်ဖြစ်အောင် လုပ်ခြင်း
- **မြန်မာဘာသာ အတွက်:** Myanmar text normalization (ယူနီကုဒ်၊ ရှေးဟောင်း/ခေတ်သစ် စာလုံးပုံစံ၊ အက္ခရာ ပေါင်းစပ်မှု)

#### အဆင့် ၃ — Tokenization (စာလုံးခွဲခြင်း)

- စာကြောင်းကို စာလုံး (token) များအဖြစ် ခွဲခြင်း
- အင်္ဂလိပ်တွင် whitespace tokenization လွယ်ကူသော်လည်း **မြန်မာစာတွင် စာလုံးခွဲခြင်း ပိုခက်ခဲ** (space မရှိဘဲ ရေးသားလေ့ရှိသည်)

#### အဆင့် ၄ — Intent Classification (ရည်ရွယ်ချက် ခွဲခြားခြင်း)

တောင်သူ၏ မေးခွန်းသည် ဘာကို မေးနေသလဲ ဆိုတာ ခွဲခြားသည်။

| Intent (ရည်ရွယ်ချက်) | ဥပမာ မေးခွန်း                    |
| -------------------- | -------------------------------- |
| `plant_disease`      | "စပါးရွက်ဝါတာ ဘာဖြစ်လဲ"          |
| `pest`               | "စပါးမှာ အင်ဆက်တိုက်တာ ဘာလဲ"     |
| `fertilizer`         | "မြေဩဇာ ဘယ်လို ထည့်ရမလဲ"         |
| `watering`           | "ရေလောင်းရမယ့် အချိန် ဘယ်တော့လဲ" |
| `technique`          | "မြေဩဇာ လုပ်နည်း ဘယ်လို လုပ်မလဲ" |

**နည်းလမ်း:**

- MVP: LLM + Prompting ဖြင့် intent ကို ခန့်မှန်းခြင်း
- နောက်ပိုင်း: Supervised classifier (TF-IDF + SVM / fine-tuned BERT)

#### အဆင့် ၅ — Named Entity Recognition (NER)

မေးခွန်းထဲမှ အရေးကြီးသော အရာများကို ထုတ်ယူသည်။

| Entity Type | ဥပမာ                       |
| ----------- | -------------------------- |
| `CROP`      | စပါး, ခရမ်းချဉ်, ခရမ်းသီး  |
| `DISEASE`   | ရွက်ပြောင်း, ရွက်လွှာ      |
| `SYMPTOM`   | ရွက်ဝါခြင်း, အစက်ပွားခြင်း |
| `PEST`      | အင်ဆက်, ပိုးမွှား          |

**ဥပမာ:**

```
Input:  "စပါးရွက်ဝါနေတာ ဘာဖြစ်လဲ"
Output: CROP=စပါး, SYMPTOM=ရွက်ဝါခြင်း
```

#### အဆင့် ၆ — Sentence Embeddings (ဝါကျ ဗေဒသွန်း)

- မေးခွန်းကို ဂဏန်းဗေဒ (vector) အဖြစ် ပြောင်းခြင်း
- အဓိပ္ပာယ်တူညီသော စာကြောင်းများသည် vector space တွင် နီးကပ်စွာ ရှိသည်
- **မော်ဒယ်များ:** Sentence-BERT, OpenAI/OpenRouter embedding models

#### အဆင့် ၇ — Semantic Search (အဓိပ္ပာယ် အခြေပြု ရှာဖွေမှု)

Keyword search နှင့် ကွဲပြားသည်—

| ရှာဖွေမှု အမျိုးအစား | ဥပမာ                                                                        |
| -------------------- | --------------------------------------------------------------------------- |
| Keyword              | "yellow" ရှာရင် "yellow leaves" သာ တွေ့                                     |
| Semantic             | "rice leaves turning pale" နှင့် "yellow leaves" ကို အဓိပ္ပာယ်တူ အဖြစ် တွေ့ |

**နည်းလမ်း:** Cosine Similarity ဖြင့် မေးခွန်း vector နှင့် ဗဟုသုတ vector များကို နှိုင်းယှဉ်ခြင်း

#### အဆင့် ၈ — RAG (Retrieval-Augmented Generation)

LLM ကို တိုက်ရိုက် မေးခြင်းထက် RAG သည် ပိုမှန်ကန်စေသည်—

1. မေးခွန်းနှင့် ဆက်စပ်သော ဗဟုသုတ ကို ရှာဖွေသည် (Retrieval)
2. ရှာတွေ့သော context ကို LLM prompt ထဲ ထည့်ပေးသည် (Augmentation)
3. LLM သည် context အခြေပြု၍ အဖြေ ထုတ်ပေးသည် (Generation)

**အားသာချက်:** Hallucination (မရှိသော အချက်အလက် ဖန်တီးခြင်း) လျှော့ချနိုင်သည်

#### အဆင့် ၉ — Text-to-Speech (TTS)

- အဖြေ စာသားကို အသံသို့ ပြောင်းခြင်း
- MVP: အင်္ဂလိပ်ဘာသာ TTS
- နောက်ပိုင်း: မြန်မာဘာသာ TTS

#### အဆင့် ၁၀ — Dialogue Context Management

- ယခင် မေးခွန်းနှင့် အဖြေများကို မှတ်သားထားခြင်း
- Follow-up မေးခွန်းများကို နားလည်နိုင်ရန် (ဥပမာ — "အဲဒါကို ဘယ်လို လုပ်ရမလဲ")

---

## ၄။ မြန်မာဘာသာ NLP ၏ အထူး စိန်ခေါ်မှုများ

ဤပရောဂျက်သည် **Low-resource Language NLP** သင်ခန်းစာနှင့် ဆက်စပ်သည်။

| စိန်ခေါ်မှု                  | ရှင်းလင်းချက်                                              |
| ---------------------------- | ---------------------------------------------------------- |
| Annotated data နည်းပါးခြင်း  | Intent/NER အတွက် label လုပ်ထားသော မြန်မာစာ dataset နည်းသည် |
| Tokenization ခက်ခဲခြင်း      | မြန်မာစာတွင် စာလုံးခွဲခြင်း ရှုပ်ထွေးသည်                   |
| Dialect / Regional variation | ဒေသအလိုက် စကားလုံးကွဲပြားမှု                               |
| Domain-specific terms        | စိုက်ပျိုးရေး technical terms (ရောဂါအမည်၊ မျိုးစိတ်အမည်)   |
| STT/TTS အရည်အသွေး            | မြန်မာအသံ မော်ဒယ်များ အင်္ဂလိပ်ထက် နည်းပါးသည်              |
| Code-mixing                  | မြန်မာ + အင်္ဂလိပ် ရောနှောပြောဆိုမှု                       |

**ဖြေရှင်းနည်း:**

- MVP တွင် အင်္ဂလိပ်ဘာသာဖြင့် pipeline စမ်းသပ်ခြင်း
- မြန်မာ dataset ကို တ်းဖြည်း စုဆောင်းခြင်း
- RAG ဖြင့် domain knowledge ကို LLM သို့ ပေးခြင်း

---

## ၅။ Dataset နှင့် NLP အတွက် ဒေတာ ဖွဲ့စည်းပုံ

### ၅.၁ ဒေတာ အရေးကြီးရခြင်း

NLP စနစ်တွင် **ဒေတာသည် အခြေခံ** ဖြစ်သည်။ မော်ဒယ် ကောင်းလျှင် ဒေတာ မကောင်းပါက ရလဒ် မကောင်းပါ။

လက်ရှိ ပရောဂျက်တွင် `data/agriculture_qa.csv` ဖိုင်တွင် **၂၅ ခု** Q&A မှတ်တမ်းများ ရှိပြီး အောက်ပါ NLP အသုံးချမှုများအတွက် အသုံးပြုနိုင်သည်—

| Field                 | NLP အသုံးချမှု                      |
| --------------------- | ----------------------------------- |
| `question` / `answer` | QA training, RAG corpus, evaluation |
| `crop`                | NER entity label (CROP)             |
| `topic`               | Intent label                        |
| `symptoms`            | NER entity label (SYMPTOM)          |
| `possible_causes`     | Knowledge extraction                |
| `solution`            | Generation target / retrieval chunk |
| `language`            | Multilingual support                |
| `verified`            | Data quality control                |

### ၅.၂ Dataset အဆင့်များ

| အဆင့် | အကြောင်းအရာ               | ရည်ရွယ်ချက်                   |
| ----- | ------------------------- | ----------------------------- |
| ၁     | Curated Q&A (50–200)      | MVP RAG + evaluation          |
| ၂     | Long-form guides → chunks | Semantic search corpus        |
| ₃     | Eval set (20–50 gold Q&A) | NLP model quality measurement |
| ၄     | Myanmar parallel data     | Burmese NLP phase             |

### ၅.၃ NLP Evaluation Metrics (တိုင်းတာမှု)

ဆရာ့ထံ ရှင်းပြရန် အသုံးပြုနိုင်သော တိုင်းတာချက်များ—

| Metric                 | ရှင်းလင်းချက်                                |
| ---------------------- | -------------------------------------------- |
| **Retrieval Recall@k** | Top-k ရလဒ်ထဲတွင် မှန်ကန်သော ဗဟုသုတ ပါ/မပါ    |
| **Answer Relevance**   | အဖေသည် မေးခွန်းနှင့် ကိုက်ညီမှု (human eval) |
| **Intent Accuracy**    | Intent classification မှန်ကန်မှု             |
| **NER F1-score**       | Entity ထုတ်ယူမှု မှန်ကန်မှု                  |
| **BLEU / ROUGE**       | (optional) Generated text vs reference       |
| **Latency**            | မေးခွန်း → အဖြေ ကြာချိန်                     |
| **Safety rate**        | အန္တရာယ်ရှိ အကြံပြုချက် မထွက်မှု နှုန်း      |

---

## ၆။ လက်ရှိ ဖွံ့ဖြိုးမှု အခြေအနေ

### ၆.၁ ပြီးစီးပြီး

- PRD နှင့် NLP architecture အစီအစဉ်
- Expo (React Native) မိုဘိုင်းအက်ပ် အခြေခံ
- စိုက်ပျိုးရေး Q&A dataset (CSV + JSON, ၂၅ entries)
- Knowledge browser UI (development / testing အတွက်)

### ၆.၂ ဆက်လက် ဖွံ့ဖြိုးရန်

- FastAPI backend + OpenRouter integration
- Vector database + embedding + RAG
- Robot assistant UI (idle / listening / thinking / speaking)
- English STT + TTS
- Myanmar NLP components (phase 2)

---

## ၇။ နည်းပညာ Stack (NLP ရှုထောင့်)

| အလွှာ      | နည်းပညာ                            | NLP အခန်းကဏ္ဍ                        |
| ---------- | ---------------------------------- | ------------------------------------ |
| Mobile     | React Native (Expo)                | STT/TTS interface, user input/output |
| Backend    | Python FastAPI                     | NLP pipeline orchestration           |
| LLM        | OpenRouter API                     | Text understanding + generation      |
| Embeddings | Sentence Transformers / OpenRouter | Semantic representation              |
| Vector DB  | Chroma / Qdrant / pgvector         | Similarity search index              |
| STT        | Whisper / Device STT               | Speech → Text                        |
| TTS        | Expo Speech / Cloud TTS            | Text → Speech                        |
| Data       | CSV / JSON                         | Training, RAG corpus, evaluation     |

---

## ၈။ ဥပမာ အပြန်အလှန် ဆက်သွယ်မှု (NLP Flow)

### MVP (အင်္ဂလိပ်)

**Input (voice/text):**

> "My rice leaves are turning yellow. What could be wrong?"

**NLP Processing:**

1. STT → text (if voice)
2. Embedding → query vector
3. Semantic search → retrieve `rice-leaf-yellow-n-deficiency` record
4. RAG prompt → OpenRouter LLM
5. Generate grounded answer
6. TTS → speak answer

**Output:**

> "Yellow rice leaves often mean nitrogen deficiency. Check your fertilizer schedule..."

### ရည်မှန်းချက် (မြန်မာ)

**Input:**

> "စပါးရွက်ဝါနေတာ ဘာဖြစ်လဲ"

**NLP Processing:**

1. Myanmar STT
2. Text normalization + tokenization
3. Intent: `nutrient_deficiency` / NER: CROP=စပါး, SYMPTOM=ရွက်ဝါခြင်း
4. Myanmar semantic search
5. RAG + LLM (Burmese response)
6. Myanmar TTS

---

## ၉။ ပရောဂျက်၏ NLP တန်ဖိုး (Teacher အတွက် အကျဉ်းချုပ်)

ဤပရောဂျက်သည် NLP သင်ခန်းစာတွင် လေ့လာရသော အကြောင်းအရာများကို **လက်တွေ့ကျကျ** ပေါင်းစပ်ထားသည်—

1. **End-to-end NLP pipeline** — အသံမှ အသံသို့ စနစ်တစ်ခုလုံး
2. **Information Retrieval + Generation** — RAG နည်းလမ်း
3. **Classification & NER** — မေးခွန်း နားလည်ခြင်း
4. **Semantic Search** — keyword မဟုတ် အဓိပ္ပာယ် အခြေပြု ရှာဖွေမှု
5. **Low-resource NLP** — မြန်မာဘာသာ စိန်ခေါ်မှုများ
6. **Domain-specific NLP** — စိုက်ပျိုးရေး နယ်ပယ်
7. **Evaluation & Safety** — မှန်ကန်မှု၊ အန္တရာယ် လျှော့ချခြင်း

---

## ၁၀။ ကိုးကား နှင့် ဆက်စပ်လေ့လာရန်

- Jurafsky & Martin — _Speech and Language Processing_ (NLP textbook)
- Lewis et al. — RAG (Retrieval-Augmented Generation)
- Devlin et al. — BERT (pre-trained language models)
- Reimers & Gurevych — Sentence-BERT (sentence embeddings)
- Myanmar NLP community resources (normalization, tokenization challenges)

---

**ဖန်တီးသူ:** တောင်သူ့ရဲ့ခေါင် ပရောဂျက်  
**စာရွက်ရည်ရွယ်ချက်:** ဆရာ/သင်တန်းဆရာ ထံ NLP အခြေခံ ပရောဂျက် ရှင်းလင်းချက်  
**နောက်ဆုံး ပြင်ဆင်ချိန်:** ၂၀၂၆

cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

