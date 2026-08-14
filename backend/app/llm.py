"""LLM integration: talking to OpenRouter (chat completions).

Everything here is specific to calling the LLM:
- the system prompt that makes the bot a farming assistant answering in Myanmar,
- building the OpenAI-style ``messages`` payload (history + RAG context),
- the out-of-scope reply used when no LLM is available.
"""
from __future__ import annotations

import json
import re
from typing import Any

import httpx

from .config import settings
from .schemas import ChatMessage

# System prompt = the bot's "personality". Key rules:
#   1. Reply in Myanmar unless the user writes in English.
#   2. Base answers ONLY on the retrieved CONTEXT (RAG) - never invent dosages.
#   3. This function is only called when the knowledge base HAS a strong match,
#      so the model should stay strictly within CONTEXT.
#   4. Refuse non-agriculture questions outright.
#   5. Keep the "cause → what to do → ask an officer" structure for advice.
SYSTEM_PROMPT = """You are တောင်သူ့ရဲ့ခေါင်, an agricultural assistant for farmers.

Rules:
1. Always answer in Myanmar (Burmese) unless the user writes in English.
2. Answer ONLY from the CONTEXT (retrieved knowledge). Do not invent pesticide dosages.
3. If CONTEXT does not actually contain the answer, say you don't know.
4. If the question is NOT about agriculture (cooking, health, politics, etc.), politely refuse and say you can only help with farming questions. Do not answer it.
5. Use this structure when giving farming advice when relevant:
   - ဖြစ်နိုင်သောအကြောင်းရင်း (possible cause)
   - ဘာလုပ်ရမည် (what to do)   
   - ဘယ်အချိန်မှာ အရာရှိကို မေးရမည် (ask an officer if)
6. Keep answers short, practical, and clear.
7. If unsure, say you don't know and recommend a local agriculture officer.
"""

# Static refusal used by the farming gate when no LLM is needed/called.
OUT_OF_SCOPE_REPLY = (
    "ကျွန်တော်သည် စိုက်ပျိုးရေးဆိုင်ရာ မေးခွန်းများအတွက်သာ ကူညီနိုင်ပါသည် — "
    "သီးနှံ၊ ပိုးမွှား၊ ရောဂါ၊ မျိုးအောင်၊ ရေသွင်းခြင်းနှင့် အခြေခံလယ်ယာနည်းပညာများ။ "
    "စိုက်ပျိုးရေးဆိုင်ရာ ပြဿနာတစ်ခုကို မေးမြန်းပေးပါ။"
)


def _history_to_messages(history: list[ChatMessage]) -> list[dict[str, str]]:
    """Convert the last few conversation turns to OpenAI-style messages.

    Only the latest 6 turns are sent to keep the prompt small and cheap.
    """
    messages: list[dict[str, str]] = []
    for item in history[-6:]:
        messages.append({"role": item.role, "content": item.content})
    return messages


async def generate_answer(
    question: str,
    context: str,
    history: list[ChatMessage],
) -> str:
    """Call OpenRouter and return the assistant's reply text.

    ``context`` is the retrieved knowledge (RAG). It is always non-empty here:
    rag.py only calls this function when a strong knowledge match exists, so
    the model is strictly grounded in CONTEXT (no general-knowledge answers).
    """
    if not settings.openrouter_api_key:
        raise RuntimeError("OPENROUTER_API_KEY is not configured")

    # The user block carries the retrieved context so the model is grounded.
    user_block = (
        f"CONTEXT:\n{context}\n\n"
        f"USER QUESTION:\n{question}"
    )

    payload: dict[str, Any] = {
        "model": settings.openrouter_model,
        "temperature": 0.2,  # low = consistent, factual answers
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            *_history_to_messages(history),
            {"role": "user", "content": user_block},
        ],
    }

    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/taung-thu-ye-khaung",
        "X-Title": settings.app_name,
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{settings.openrouter_base_url.rstrip('/')}/chat/completions",
            headers=headers,
            json=payload,
        )
        response.raise_for_status()
        data = response.json()

    try:
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError(f"Unexpected OpenRouter response: {json.dumps(data)[:500]}") from exc

    return str(content).strip()


def strip_markdown_noise(text: str) -> str:
    """Collapse 3+ newlines to 2 and trim — cosmetic cleanup of LLM output."""
    return re.sub(r"\n{3,}", "\n\n", text).strip()
