from __future__ import annotations

import json
import re
from typing import Any

import httpx

from .config import settings
from .schemas import ChatMessage

SYSTEM_PROMPT = """You are တောင်သူ့ရဲ့ခေါင်, an agricultural assistant for farmers.
Answer ONLY farming questions using the retrieved knowledge context when possible.

Rules:
1. Prefer facts from the provided CONTEXT. Do not invent pesticide dosages.
2. Use this structure when giving farming advice:
   - Possible cause
   - What to do
   - Ask an officer if
3. If the question is not about farming, or CONTEXT is empty/weak, say you can only help with farming and ask them to rephrase.
4. Keep answers short, practical, and clear (English).
5. If unsure, say you don't know and recommend a local agriculture officer.
"""


def _history_to_messages(history: list[ChatMessage]) -> list[dict[str, str]]:
    messages: list[dict[str, str]] = []
    for item in history[-6:]:
        messages.append({"role": item.role, "content": item.content})
    return messages


async def generate_answer(
    question: str,
    context: str,
    history: list[ChatMessage],
    has_strong_match: bool,
) -> str:
    if not settings.openrouter_api_key:
        raise RuntimeError("OPENROUTER_API_KEY is not configured")

    user_block = (
        f"CONTEXT:\n{context or '(no relevant knowledge found)'}\n\n"
        f"Strong knowledge match: {'yes' if has_strong_match else 'no'}\n\n"
        f"USER QUESTION:\n{question}"
    )

    payload: dict[str, Any] = {
        "model": settings.openrouter_model,
        "temperature": 0.2,
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


OUT_OF_SCOPE_REPLY = (
    "I can only help with farming questions — crops, pests, diseases, fertilizer, "
    "watering, and basic farm techniques. Please ask about a farming problem."
)


def strip_markdown_noise(text: str) -> str:
    return re.sub(r"\n{3,}", "\n\n", text).strip()
