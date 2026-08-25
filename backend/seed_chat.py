"""Seed the QuestionLog table with realistic mock chat data.

Usage:
    cd FarmBotMyanmar
    python -m backend.seed_chat

Idempotent: skips if the table already has rows.
"""

from __future__ import annotations

import json
import sqlite3
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "web" / "dev.db"

MOCK_DATA = [
    {
        "question": "စပါးမှာ ဘာရောဂါဖြစ်နေလဲ",
        "intent": "DISEASE_IDENTIFICATION",
        "crop": "rice",
        "disease": "blast",
        "out_of_scope": False,
        "used_llm": True,
        "source_ids": ["rice-blast", "rice-bacterial-blight"],
        "answer": "စပါးမှာ ဘက်တီးရီးယား အမြီးနီရောဂါ (Bacterial Leaf Blight) ဖြစ်နိုင်ပါတယ်။ အရွက်တွေ အဝါရောင်ပြောင်းပြီး အမြီးကနေ စတင်ပါတယ်။",
        "response_ms": 1850,
        "user_id": "user-001",
    },
    {
        "question": "How to grow tomatoes?",
        "intent": "CULTIVATION",
        "crop": "tomato",
        "disease": None,
        "out_of_scope": False,
        "used_llm": True,
        "source_ids": ["tomato-cultivation"],
        "answer": "Tomatoes need well-drained soil, full sun (6-8 hours), and regular watering. Plant seedlings 18-24 inches apart. Stake or cage plants for support.",
        "response_ms": 1200,
        "user_id": "user-002",
    },
    {
        "question": "ငရုတ်ပင်မှာ ပိုးတွေ့နေရတယ်",
        "intent": "PEST_CONTROL",
        "crop": "chili",
        "pest": "aphid",
        "out_of_scope": False,
        "used_llm": False,
        "source_ids": ["chili-pest-control"],
        "answer": "ငရုတ်ပင်မှာ aphid ပိုးတွေကို neem oil ဖျော်ရည်နဲ့ ဖျန်းပေးပါ။ သဘာဝနည်းလမ်းအဖြစ် ladybug တွေကို ဆွဲဆောင်နိုင်ပါတယ်။",
        "response_ms": 450,
        "user_id": "user-001",
    },
    {
        "question": "ဘာမြေသြဇာသုံးရမလဲ",
        "intent": "FERTILIZER",
        "crop": "rice",
        "fertilizer": "urea",
        "out_of_scope": False,
        "used_llm": False,
        "source_ids": ["rice-fertilizer"],
        "answer": "စပါးအတွက် urea (46-0-0) ကို အရွက်စိမ်းအဆင့်မှာ သုံးပါ။ NPK ဓာတ်မြေသြဇာကို စိုက်ပျိုးချိန်မှာ ထည့်ပါ။",
        "response_ms": 380,
        "user_id": "user-003",
    },
    {
        "question": "My bean plants have yellow leaves, what disease is this?",
        "intent": "DISEASE_IDENTIFICATION",
        "crop": "bean",
        "disease": "rust",
        "out_of_scope": False,
        "used_llm": True,
        "source_ids": ["bean-disease"],
        "answer": "Yellow leaves on beans can indicate rust disease. Look for small brown/orange pustules on the undersides of leaves. Remove affected leaves and apply fungicide.",
        "response_ms": 1500,
        "user_id": "user-002",
    },
    {
        "question": "ရေဘယ်လောက်သွင်းရမလဲ",
        "intent": "WATER_MANAGEMENT",
        "crop": "rice",
        "out_of_scope": False,
        "used_llm": False,
        "source_ids": ["rice-water-management"],
        "answer": "စပါးစိုက်ချိန်မှာ ရေအနက် ၂-၃ လက်မထားပါ။ ပင်စည်အဆင့်မှာ ရေကို ဖြည်ဖြည်ချပါ။ ရိတ်ခါနီး ၂ ပတ်အလိုက ရေဆွဲပါ။",
        "response_ms": 420,
        "user_id": "user-001",
    },
    {
        "question": "ဘယ်အချိန်ရိတ်သိမ်းရမလဲ",
        "intent": "HARVESTING",
        "crop": "rice",
        "out_of_scope": False,
        "used_llm": False,
        "source_ids": ["rice-harvesting"],
        "answer": "စပါးကို အရွက်ဝါပြီး အစေ့များ မာလာတဲ့အခါ ရိတ်သိမ်းပါ။ စိုက်ပြီး ၁၂၀-၁၅၀ ရက်ခန့်မှာ ရိတ်နိုင်ပါတယ်။",
        "response_ms": 350,
        "user_id": "user-003",
    },
    {
        "question": "How to prevent pest infestation on eggplant?",
        "intent": "PREVENTION",
        "crop": "eggplant",
        "out_of_scope": False,
        "used_llm": True,
        "source_ids": ["eggplant-pest-prevention"],
        "answer": "To prevent pests on eggplant: 1) Use neem oil spray every 2 weeks, 2) Practice crop rotation, 3) Remove plant debris after harvest, 4) Use companion planting with basil.",
        "response_ms": 1350,
        "user_id": "user-002",
    },
    {
        "question": "ဘာကြက်သွန်ဖြူသုံးရမလဲ",
        "intent": "GENERAL_INFORMATION",
        "crop": "onion",
        "out_of_scope": False,
        "used_llm": False,
        "source_ids": ["onion-general"],
        "answer": "ကြက်သွန်ဖြူကို အမျိုးမျိုးသုံးနိုင်ပါတယ်။ ဟင်းချက်ခြင်း၊ ဆေးဝါးအဖြစ်သုံးခြင်း စတာတွေ ပါဝင်ပါတယ်။",
        "response_ms": 280,
        "user_id": "user-004",
    },
    {
        "question": "ကျွန်တော့်မှာ ကျန်းမာရေးပြဿနာရှိတယ်",
        "intent": "OTHER",
        "out_of_scope": True,
        "used_llm": False,
        "source_ids": [],
        "answer": "ကျွန်တော်/ကျွန်မက စိုက်ပျိုးရေးဆိုင်ရာ မေးခွန်းတွေပဲ ဖြေနိုင်ပါတယ်။ ကျန်းမာရေးနဲ့ပတ်သက်ပြီး ဆရာဝန်ကို မေးပါ။",
        "response_ms": 150,
        "user_id": "user-004",
    },
    {
        "question": "ခရမ်းချဉ်မှာ ဘာဆေးသုံးရမလဲ",
        "intent": "DISEASE_TREATMENT",
        "crop": "tomato",
        "disease": "blight",
        "fertilizer": None,
        "out_of_scope": False,
        "used_llm": True,
        "source_ids": ["tomato-blight-treatment"],
        "answer": "ခရမ်းချဉ် blight အတွက် copper-based fungicide သုံးပါ။ ရောဂါဖြစ်နေတဲ့ အပင်တွေကို ဖယ်ရှားပြီး ကျန်တဲ့ အပင်တွေကို ဖျန်းပေးပါ။",
        "response_ms": 1650,
        "user_id": "user-001",
    },
    {
        "question": "maize planting distance",
        "intent": "CULTIVATION",
        "crop": "maize",
        "out_of_scope": False,
        "used_llm": False,
        "source_ids": ["maize-cultivation"],
        "answer": "Plant maize seeds 8-12 inches apart in rows 30-36 inches apart. Plant seeds 1-2 inches deep. Ensure adequate spacing for air circulation.",
        "response_ms": 320,
        "user_id": "user-002",
    },
    {
        "question": "ဘုန်းလေးပိုးကို ဘယ်လိုကာကွယ်ရမလဲ",
        "intent": "PEST_CONTROL",
        "crop": "rice",
        "pest": "stem borer",
        "out_of_scope": False,
        "used_llm": True,
        "source_ids": ["rice-pest-control", "rice-stem-borer"],
        "answer": "ဘုန်းလေးပိုးကို ကာကွယ်ဖို့: ၁) pheromone trap များ အသုံးပြုပါ။ ၂) ရေချိုင့်ချက်များကို ဖယ်ရှားပါ။ ၃) balanced fertilizer သုံးပါ။",
        "response_ms": 1400,
        "user_id": "user-003",
    },
    {
        "question": "cabbage什么时候种最好",
        "intent": "CULTIVATION",
        "crop": "cabbage",
        "out_of_scope": False,
        "used_llm": True,
        "source_ids": ["cabbage-cultivation"],
        "answer": "Cabbage is best planted in cool weather. In Myanmar, plant during October-November for the best results. Seedlings take 6-8 weeks to mature.",
        "response_ms": 1100,
        "user_id": "user-004",
    },
    {
        "question": "ဘယ်လို မြေကိုပြင်ဆင်ရမလဲ",
        "intent": "CULTIVATION",
        "crop": None,
        "out_of_scope": False,
        "used_llm": False,
        "source_ids": ["soil-preparation"],
        "answer": "မြေကို ပြင်ဆင်ဖို့: ၁) မြေကို နက်နက် ထွန်ပါ။ ၂) အမှုန့်မြေသြဇာ ထည့်ပါ။ ၃) ရေစီးရေလာ ကောင်းအောင် ပြင်ဆင်ပါ။ ၄) pH 6.0-7.0 ရှိအောင် စစ်ဆေးပါ။",
        "response_ms": 480,
        "user_id": "user-001",
    },
]


def seed() -> None:
    if not DB_PATH.exists():
        print(f"Database not found at {DB_PATH}")
        sys.exit(1)

    conn = sqlite3.connect(str(DB_PATH))

    # Check if table already has data.
    count = conn.execute("SELECT COUNT(*) FROM QuestionLog").fetchone()[0]
    if count > 0:
        print(f"QuestionLog already has {count} rows — skipping seed.")
        conn.close()
        return

    now = datetime.now(timezone.utc)
    base = now - timedelta(days=7)

    for i, row in enumerate(MOCK_DATA):
        ts = (base + timedelta(hours=i * 8, minutes=i * 13)).isoformat()
        conn.execute(
            """INSERT INTO QuestionLog
               (ts, question, intent, entities, outOfScope, usedLlm, sourceIds, answer, responseMs, userId)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                ts,
                row["question"],
                row["intent"],
                json.dumps(
                    {k: row.get(k) for k in ("crop", "disease", "pest", "fertilizer") if row.get(k)},
                    ensure_ascii=False,
                ),
                1 if row["out_of_scope"] else 0,
                1 if row["used_llm"] else 0,
                json.dumps(row["source_ids"]),
                row["answer"],
                row["response_ms"],
                row.get("user_id"),
            ),
        )

    conn.commit()
    conn.close()
    print(f"Seeded {len(MOCK_DATA)} mock chat entries into QuestionLog.")


if __name__ == "__main__":
    seed()
