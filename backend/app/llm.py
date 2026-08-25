"""LLM integration: talking to OpenRouter (chat completions).

Everything here is specific to calling the LLM:
- the agriculture gate prompt that decides whether a question is in scope,
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
from .retrieval import _has_myanmar
from .schemas import ChatMessage, IntentNerResult

# System prompt = the bot's "personality". Key rules:
#   1. Reply in the user's language; honor an explicit language request.
#   2. Base answers ONLY on the retrieved CONTEXT (RAG) - never invent dosages.
#   3. This function is only called when the knowledge base HAS a strong match,
#      so the model should stay strictly within CONTEXT.
#   4. Refuse non-agriculture questions outright.
#   5. Conversational, friendly, helpful tone (Gemini-like) with light markdown.
SYSTEM_PROMPT = """You are တောင်သူ့ရဲ့ခေါင်, a friendly and helpful agricultural assistant for farmers.

Language:
- Reply in the same language the user is writing in.
- If the user explicitly asks for a specific language (e.g. "in English",
  "အင်္လိပ်လို ဖြေပါ", "用中文", "回答用英文"), answer in THAT language.
- When the user's language is unclear, default to Myanmar (Burmese).

Answering:
- Base your answer ONLY on the CONTEXT (retrieved knowledge). Never invent
  pesticide, fertilizer, or chemical dosages that are not in the CONTEXT.
- The CONTEXT is the knowledge-base article(s) you are given. Use whatever
  relevant information it contains to give a helpful, practical reply. Even when
  it does not contain a full step-by-step, share the useful facts/tips/background
  it does have and invite a follow-up question at the end.
- NEVER reply with a bare "I don't have this information" / "not included" /
  "ဒီမှာမပါဝင်ပါဘူး" message when an article IS provided in the CONTEXT. If the
  CONTEXT is related to the question but does not directly answer it, give the
  related background it provides and ask a follow-up. Only say you lack the
  information if the CONTEXT is truly EMPTY.
- If the question is NOT about agriculture (cooking, human/animal health,
  politics, etc.), politely refuse and say you only help with farming questions.

Style:
- Be warm, conversational, and practical — like a knowledgeable neighbor.
- Use light markdown (short headings, bullet points) so answers are easy to read
  on a phone. Keep it clear and not overly long.
- When giving farming advice, a simple flow works well: possible cause ->
  what to do -> when to ask an agriculture officer.
- If something is uncertain, say so and recommend a local agriculture officer.
"""

# System prompt for the clarification stage. Used when the question is clearly
# about farming but missing a key detail (e.g. which crop, which disease/symptom)
# so the bot asks ONE friendly follow-up instead of guessing or saying "no info".
CLARIFICATION_SYSTEM_PROMPT = """You are တောင်သူ့ရဲ့ခေါင်, a friendly agricultural assistant.

The user's question is about farming, but it is missing a key detail needed to
give a good answer. Ask the user exactly ONE short, friendly follow-up question
to get that missing detail. Do NOT answer the farming question yet.

Guidance:
- Reply in the same language the user wrote in. If they explicitly asked for a
  language, use it; otherwise default to Myanmar (Burmese).
- The most common missing detail is the crop/plant. Example: "ဘယ်သီးနှံအတွက် သိချင်တာလဲ?"
  (Which crop is this about?). You may offer 1-3 example crops as choices.
- If the crop is known but the disease/symptom/pest is missing, ask what they
  see (e.g. "ဘာလို့ဖြစ်တယ်လို့ ထင်လဲ? သို့မဟုတ် ဘယ်လိုရောဂါလက္ခဏာမျိုး တွေ့ရလဲ?").
- Keep it to one question, warm and concise. No markdown headers.
"""

# System prompt for the agriculture gate. This runs FIRST, before retrieval and
# before any answer LLM call: it decides whether the question is in scope. The
# model replies with exactly one word so parsing is cheap and deterministic.
AGRICULTURE_GATE_SYSTEM_PROMPT = """You are the scope filter for တောင်သူ့ရဲ့ခေါင်, a Myanmar farming assistant.

Decide whether the user's question is about AGRICULTURE (farming).

AGRICULTURE = growing or caring for crops/plants: pests, plant diseases,
fertilizer, soil, irrigation/watering, seeds, seedlings, mulching, harvesting,
cultivation techniques, crop loss.

NOT_AGRICULTURE = anything else: cooking recipes/dishes, human or animal health
and medicine, weather, news, politics, shopping, math, coding, general chat.
Note: naming a crop/plant (e.g. "watermelon", "ဖရဲသီး", "rice") in a farming or
cultivation context IS agriculture. Only non-farming uses of a crop — a recipe,
cooking, or eating it — are NOT agriculture.

A short follow-up question (e.g. "ဒါဆို ဘာလုပ်ရမလဲ?", "why?", "what about that?")
that continues a previous farming conversation counts as AGRICULTURE when the
history shows the conversation is about farming.

Reply with exactly one word: AGRICULTURE or NOT_AGRICULTURE."""

# System prompt for the intent + NER stage (prd.md §8–§10). The model must
# answer with ONE JSON object so the pipeline gets structured {intent, entities}
# that drive the retrieval query and (optionally) crop filtering.
INTENT_NER_SYSTEM_PROMPT = """You are the NLP stage of တောင်သူ့ရဲ့ခေါင်, a Myanmar farming assistant.

Read the user's question and output ONE JSON object with exactly these keys:

intent: one of GENERAL_INFORMATION, CULTIVATION, DISEASE_IDENTIFICATION,
  DISEASE_TREATMENT, PEST_CONTROL, FERTILIZER, WATER_MANAGEMENT, HARVESTING,
  PREVENTION, OTHER
crop: the crop/plant mentioned, lowercase English (e.g. "rice"); null if none
disease: the disease named or clearly described (e.g. "blast"); null if none
pest: the pest/insect named; null if none
symptom: the symptom described, concise English; null if none
fertilizer: the fertilizer/nutrient mentioned; null if none
pesticide: the pesticide/chemical mentioned; null if none
plant_part: the plant part (leaf, stem, root, fruit...); null if none
location: the region/location mentioned; null if none

Intent guidance (what the farmer WANTS):
- CULTIVATION: how to plant / grow / manage a crop
- DISEASE_IDENTIFICATION: what disease is this / why is this happening
- DISEASE_TREATMENT: what medicine/chemical to use for a disease (e.g. "ဘာဆေးသုံးရမလဲ")
- PEST_CONTROL: a pest or how to control it
- FERTILIZER: fertilizer / soil nutrition
- WATER_MANAGEMENT: watering / irrigation / drainage
- HARVESTING: when or how to harvest
- PREVENTION: how to prevent / protect
- GENERAL_INFORMATION: general questions about a crop
- OTHER: none of the above

Rules:
- Prefer lowercase English values where possible; keep original text if the
  entity only exists in Myanmar.
- Read the conversation history to resolve follow-ups (e.g. "ဒါဆို ဘာလုပ်ရမလဲ"
  inherits the crop/disease from earlier turns).
- Return ONLY the JSON object. No markdown, no comments, no extra text."""

# Static refusal used by the farming gate when no LLM is needed/called.
OUT_OF_SCOPE_REPLY = (
    "ကျွန်တော်သည် စိုက်ပျိုးရေးဆိုင်ရာ မေးခွန်းများအတွက်သာ ကူညီနိုင်ပါသည် — "
    "သီးနှံ၊ ပိုးမွှား၊ ရောဂါ၊ မျိုးအောင်၊ ရေသွင်းခြင်းနှင့် အခြေခံလယ်ယာနည်းပညာများ။ "
    "စိုက်ပျိုးရေးဆိုင်ရာ ပြဿနာတစ်ခုကို မေးမြန်းပေးပါ။"
)
OUT_OF_SCOPE_REPLY_EN = (
    "I can only help with farming questions — crops, pests, diseases, seeds, "
    "watering, and basic agriculture. Please ask me about a farming problem."
)

# Returned when the LLM key is not configured. With no LLM there is no answer
# path and no heuristic/template fallback — we refuse explicitly instead.
SERVICE_UNAVAILABLE_REPLY = (
    "တောင်းပန်ပါသည်၊ AI ဖြေကြားမှု ဝန်ဆောင်မှု (LLM) ကို လောလောင်းစက် မသတ်မှတ်ရသေးပါ။ "
    "စနစ်အကြားအမှုဆောင်သူထံ ဆက်သွယ်ပြီး LLM သော့ သတ်မှတ်ပေးပါ။"
)
SERVICE_UNAVAILABLE_REPLY_EN = (
    "Sorry, the AI answering service (LLM) is not configured yet. Please "
    "contact the system administrator to set the LLM key."
)

# Returned when the LLM key is set but the answer call fails (network/API). No
# knowledge-template fallback — we say we couldn't answer rather than guess.
ANSWER_FAILED_REPLY = (
    "တောင်းပန်ပါသည်၊ ဖြေကြားမှုကို ယခုအချိန်တွင် မရယူနိုင်ပါ။ ခဏကြာပြီး ထပ်မံကြိုးစားကြည့်ပါ။"
)
ANSWER_FAILED_REPLY_EN = (
    "Sorry, I couldn't get an answer right now. Please try again in a moment."
)


def is_burmese(text: str) -> bool:
    """True when ``text`` is written in Myanmar (Burmese).

    Used to pick the reply language for static fallback messages: anything that
    is not Myanmar-script is treated as English (the bot's secondary language),
    matching the SYSTEM_PROMPT default-to-Burmese-when-unclear rule in reverse.
    """
    return _has_myanmar(text)


def localized(question: str, my: str, en: str) -> str:
    """Return the reply in the user's language.

    Burmese input -> Burmese reply; everything else (English, other scripts) ->
    English reply. This keeps the static "no knowledge" / out-of-scope / error
    messages in the same language the user wrote in.
    """
    return my if is_burmese(question) else en


def reply_language(question: str) -> str:
    """The language the bot must answer in, derived from the user's question.

    Burmese-script questions -> "Burmese (Myanmar)"; everything else (English or
    any other script) -> "English". This is injected as an explicit directive
    into the answer prompts because the retrieved CONTEXT is Burmese and the LLM
    would otherwise default to answering in Burmese regardless of the user's
    language.
    """
    return "Burmese (Myanmar)" if is_burmese(question) else "English"

# Common crop name hints so the NER stage maps Myanmar crop words correctly
# (e.g. ခရမ်းချဉ် = tomato, NOT eggplant). Only used when grounding the
# intent+NER prompt with the KB crop list.
CROP_MYANMAR_HINTS = {
    "rice": "စပါး",
    "tomato": "ခရမ်းချဉ်",
    "chili": "ငရုတ်",
    "eggplant": "ခရမ်းသီး",
    "cabbage": "ဂေါ်ဖီ",
    "onion": "ကြက်သွန်",
    "maize": "ပြောင်း",
    "bean": "ပဲ",
    "potato": "အာလူး",
    "sugarcane": "ကြံ",
    "peanut": "မြေပဲ",
    "watermelon": "ဖရဲသီး",
}


def _extract_json_object(text: str) -> dict[str, Any]:
    """Pull the first balanced {...} block out of an LLM response.

    Robust to stray markdown fences / surrounding prose that some models add.
    """
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError(f"No JSON object in response: {text[:200]!r}")
    try:
        return json.loads(text[start : end + 1])
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON in response: {text[start:end+1][:200]!r}") from exc


def _history_to_messages(history: list[ChatMessage]) -> list[dict[str, str]]:
    """Convert the last few conversation turns to OpenAI-style messages.

    Only the latest 6 turns are sent to keep the prompt small and cheap.
    """
    messages: list[dict[str, str]] = []
    for item in history[-6:]:
        messages.append({"role": item.role, "content": item.content})
    return messages


def _openrouter_headers() -> dict[str, str]:
    """Headers shared by every OpenRouter call (auth + attribution)."""
    return {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/taung-thu-ye-khaung",
        "X-Title": settings.app_name,
    }


async def classify_agriculture(
    question: str,
    history: list[ChatMessage],
) -> bool:
    """LLM gate: is the question about agriculture?

    Runs before retrieval so non-farming questions are refused without wasting
    embedding / cross-encoder / answer work. Raises on failure so the pipeline
    can fall back to the keyword heuristic.
    """
    if not settings.openrouter_api_key:
        raise RuntimeError("OPENROUTER_API_KEY is not configured")

    # The last few turns are included so follow-ups ("ဒါဆို ဘာလုပ်ရမလဲ?")
    # inside a farming conversation are not rejected as out-of-scope.
    payload: dict[str, Any] = {
        "model": settings.openrouter_filter_model or settings.openrouter_model,
        "temperature": 0.0,  # deterministic verdict
        "messages": [
            {"role": "system", "content": AGRICULTURE_GATE_SYSTEM_PROMPT},
            *_history_to_messages(history)[-4:],
            {"role": "user", "content": question},
        ],
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{settings.openrouter_base_url.rstrip('/')}/chat/completions",
            headers=_openrouter_headers(),
            json=payload,
        )
        response.raise_for_status()
        data = response.json()

    try:
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError(f"Unexpected OpenRouter response: {json.dumps(data)[:500]}") from exc

    verdict = str(content).strip().upper()
    # Check NOT_AGRICULTURE first: it contains "AGRICULTURE" as a substring.
    if "NOT_AGRICULTURE" in verdict:
        return False
    if "AGRICULTURE" in verdict:
        return True
    raise RuntimeError(f"Unexpected gate verdict: {content!r}")


async def extract_intent_ner(
    question: str,
    history: list[ChatMessage],
    crops: list[str] | None = None,
) -> IntentNerResult:
    """LLM stage: intent classification + NER in one structured JSON call.

    Returns the 10-intent label plus crop/disease/pest/symptom/... entities
    (prd.md §8–§10). ``crops`` (the KB's crop list) is passed to the model so
    the detected crop is grounded in the knowledge base instead of hallucinated.
    Raises on failure so the pipeline can fall back to the lexicon heuristic.
    """
    if not settings.openrouter_api_key:
        raise RuntimeError("OPENROUTER_API_KEY is not configured")

    system_prompt = INTENT_NER_SYSTEM_PROMPT
    if crops:
        names = ", ".join(
            f"{name} = {CROP_MYANMAR_HINTS[name]}"
            for name in sorted(crops)
            if CROP_MYANMAR_HINTS.get(name)
        )
        system_prompt += (
            "\n\nKnown crop names in our knowledge base: "
            + ", ".join(sorted(crops))
            + ". "
            "Set crop ONLY to one of these names when the question clearly "
            "mentions that crop; otherwise set crop to null."
        )
        if names:
            system_prompt += f"\nMyanmar name hints: {names}."

    payload: dict[str, Any] = {
        "model": settings.openrouter_filter_model or settings.openrouter_model,
        "temperature": 0.0,  # deterministic structured output
        "messages": [
            {"role": "system", "content": system_prompt},
            *_history_to_messages(history)[-4:],
            {"role": "user", "content": question},
        ],
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{settings.openrouter_base_url.rstrip('/')}/chat/completions",
            headers=_openrouter_headers(),
            json=payload,
        )
        response.raise_for_status()
        data = response.json()

    try:
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError(f"Unexpected OpenRouter response: {json.dumps(data)[:500]}") from exc

    return IntentNerResult.model_validate(_extract_json_object(str(content)))


# System prompt for the query-translation stage. When a user writes in a
# non-Burmese language (e.g. English) we translate their question into Burmese
# before retrieval, because the knowledge base and the reranker are Burmese.
_TRANSLATE_SYSTEM_PROMPT = """You are a translation engine for a Myanmar (Burmese) farming assistant.

Translate the user's text into Burmese (Myanmar language, Unicode). Output ONLY the Burmese translation — no explanation, no quotation marks, no extra text. If the text is already Burmese or has nothing to translate, return it unchanged."""


async def translate_to_burmese(text: str) -> str:
    """Translate a question/query into Burmese for retrieval against the KB.

    The knowledge base and cross-encoder reranker are Burmese-centric, so a
    non-Burmese query is translated first to stay in-distribution. Raises on
    failure so callers can fall back to the original text.
    """
    if not settings.openrouter_api_key:
        raise RuntimeError("OPENROUTER_API_KEY is not configured")

    payload: dict[str, Any] = {
        "model": settings.openrouter_filter_model or settings.openrouter_model,
        "temperature": 0.0,
        "messages": [
            {"role": "system", "content": _TRANSLATE_SYSTEM_PROMPT},
            {"role": "user", "content": text},
        ],
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{settings.openrouter_base_url.rstrip('/')}/chat/completions",
            headers=_openrouter_headers(),
            json=payload,
        )
        response.raise_for_status()
        data = response.json()

    try:
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError(f"Unexpected OpenRouter response: {json.dumps(data)[:500]}") from exc

    translated = str(content).strip()
    if not translated:
        raise RuntimeError("Empty translation response")
    return translated


async def _stream_openrouter(payload: dict[str, Any]):
    """Stream text deltas from OpenRouter for ``payload``.

    Raises ``httpx.HTTPStatusError`` (e.g. 400) before yielding anything if the
    request is rejected, so callers can retry with a different payload.
    """
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(connect=10.0, read=None, write=10.0, pool=10.0)
    ) as client:
        async with client.stream(
            "POST",
            f"{settings.openrouter_base_url.rstrip('/')}/chat/completions",
            headers=_openrouter_headers(),
            json=payload,
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line or not line.startswith("data:"):
                    continue
                data = line[len("data:"):].strip()
                if data == "[DONE]":
                    break
                try:
                    obj = json.loads(data)
                except json.JSONDecodeError:
                    continue
                try:
                    delta = obj["choices"][0]["delta"].get("content")
                except (KeyError, IndexError, TypeError):
                    continue
                if delta:
                    yield delta


def _answer_payloads(messages: list[dict[str, str]], *, stream: bool = False) -> list[dict[str, Any]]:
    """Payloads to try for the answer model, best-first.

    We raise the output cap with ``max_tokens`` so long answers are not cut off
    by OpenRouter's default limit, then fall back to a bare request if that
    parameter is rejected (e.g. HTTP 400) so streaming never breaks for every
    question. ``stream`` must be True for the token-streaming path.
    """
    base: dict[str, Any] = {
        "model": settings.openrouter_model,
        "temperature": 0.5,
        "stream": stream,
        "messages": messages,
    }
    return [
        {**base, "max_tokens": settings.openrouter_max_tokens},
        {**base},
    ]


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

    lang = reply_language(question)
    user_block = (
        f"[LANGUAGE REQUIREMENT: The user wrote in {lang}. "
        f"You MUST write your entire answer in {lang}. "
        f"The knowledge below is in Burmese, but your reply language must be {lang}.]\n\n"
        f"CONTEXT:\n{context}\n\n"
        f"USER QUESTION:\n{question}"
    )
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        *_history_to_messages(history),
        {"role": "user", "content": user_block},
    ]

    last_exc: Exception | None = None
    for payload in _answer_payloads(messages):
        try:
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(connect=10.0, read=None, write=10.0, pool=10.0)
            ) as client:
                response = await client.post(
                    f"{settings.openrouter_base_url.rstrip('/')}/chat/completions",
                    headers=_openrouter_headers(),
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()
            try:
                content = data["choices"][0]["message"]["content"]
            except (KeyError, IndexError, TypeError) as exc:
                raise RuntimeError(f"Unexpected OpenRouter response: {json.dumps(data)[:500]}") from exc
            return format_gemini_reply(str(content).strip())
        except httpx.HTTPStatusError as exc:
            # A rejected parameter (e.g. 400) shouldn't kill every answer —
            # try the next, simpler payload.
            if exc.response.status_code != 400:
                raise
            last_exc = exc
            continue
    raise last_exc if last_exc else RuntimeError("All answer payloads failed")


async def generate_answer_stream(
    question: str,
    context: str,
    history: list[ChatMessage],
):
    """Stream the assistant's reply token-by-token from OpenRouter.

    Yields raw text deltas (``str``) as they arrive so the caller can forward
    them to the client. The final assembled text should be formatted with
    :func:`format_gemini_reply` once complete. Same grounding rules as
    :func:`generate_answer` — only called when a strong knowledge match exists.
    """
    if not settings.openrouter_api_key:
        raise RuntimeError("OPENROUTER_API_KEY is not configured")

    lang = reply_language(question)
    user_block = (
        f"[LANGUAGE REQUIREMENT: The user wrote in {lang}. "
        f"You MUST write your entire answer in {lang}. "
        f"The knowledge below is in Burmese, but your reply language must be {lang}.]\n\n"
        f"CONTEXT:\n{context}\n\n"
        f"USER QUESTION:\n{question}"
    )
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        *_history_to_messages(history),
        {"role": "user", "content": user_block},
    ]

    last_exc: Exception | None = None
    for payload in _answer_payloads(messages, stream=True):
        try:
            async for delta in _stream_openrouter(payload):
                yield delta
            return
        except httpx.HTTPStatusError as exc:
            # A rejected parameter (e.g. 400) shouldn't kill streaming for every
            # question — try the next, simpler payload.
            if exc.response.status_code != 400:
                raise
            last_exc = exc
            continue
    raise last_exc if last_exc else RuntimeError("All stream payloads failed")


async def generate_clarification(
    question: str,
    ner: IntentNerResult,
    history: list[ChatMessage],
) -> str:
    """Ask ONE friendly follow-up when a farming question is missing key info.

    Only called from rag.py when retrieval found no strong match but the scope
    gate confirmed the question IS about farming and a required entity (crop /
    disease / symptom) is missing.
    """
    if not settings.openrouter_api_key:
        raise RuntimeError("OPENROUTER_API_KEY is not configured")

    missing = []
    if ner.crop is None:
        missing.append("crop/plant")
    if ner.intent in ("DISEASE_IDENTIFICATION", "DISEASE_TREATMENT", "PEST_CONTROL"):
        if not (ner.disease or ner.pest or ner.symptom):
            missing.append("disease/pest/symptom")

    lang = reply_language(question)
    user_block = (
        f"[LANGUAGE REQUIREMENT: Write your reply in {lang}.]\n\n"
        f"USER QUESTION:\n{question}\n\n"
        f"WHAT WE ALREADY KNOW (from analysis):\n"
        f"- intent: {ner.intent}\n"
        f"- crop: {ner.crop or 'MISSING'}\n"
        f"- disease: {ner.disease or 'MISSING'}\n"
        f"- pest: {ner.pest or 'MISSING'}\n"
        f"- symptom: {ner.symptom or 'MISSING'}\n\n"
        f"Missing detail(s) to ask about: {', '.join(missing) or 'some detail'}"
    )

    payload: dict[str, Any] = {
        "model": settings.openrouter_model,
        "temperature": 0.4,
        "messages": [
            {"role": "system", "content": CLARIFICATION_SYSTEM_PROMPT},
            *_history_to_messages(history),
            {"role": "user", "content": user_block},
        ],
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{settings.openrouter_base_url.rstrip('/')}/chat/completions",
            headers=_openrouter_headers(),
            json=payload,
        )
        response.raise_for_status()
        data = response.json()

    try:
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError(f"Unexpected OpenRouter response: {json.dumps(data)[:500]}") from exc

    return format_gemini_reply(str(content).strip())


def format_gemini_reply(text: str) -> str:
    """Turn a Gemini/LLM reply into clean, app-ready text.

    The Expo UI renders the answer as plain text, so we strip markdown syntax
    but keep the structure — line breaks and bullets — so replies read naturally
    on a phone. Also drops any ``<think>`` reasoning artifacts that thinking
    models may leak.
    """
    # Drop <think>...</think> reasoning traces (Gemini 2.5 thinking).
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL | re.IGNORECASE)
    # Bullets first (consume the leading "* " / "- " so the "*" isn't later
    # mistaken for an emphasis marker).
    text = re.sub(r"(?m)^\s*[\*\-]\s+", "• ", text)
    # Strip emphasis + inline-code markers, then any stray "*".
    text = text.replace("**", "").replace("`", "").replace("*", "")
    # Headings: drop leading "#" runs at the start of a line.
    text = re.sub(r"(?m)^\s{0,3}#{1,6}\s*", "", text)
    # Collapse 3+ newlines to 2 and trim trailing spaces on each line.
    text = re.sub(r"[ \t]+$", "", text, flags=re.MULTILINE)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()
