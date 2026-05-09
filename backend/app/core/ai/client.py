"""
Anthropic AI Client — مفتاح واحد للمنصة يخدم كل المستخدمين
يدير التكاليف ويطبّق حدود الاستهلاك لكل خطة
"""
from typing import AsyncGenerator, Optional
from anthropic import AsyncAnthropic, APIError

from app.core.config import settings, ANTHROPIC_MODELS

# تكلفة كل مليون token بالدولار
COST_PER_MTK = {
    "haiku":      {"input": 0.25,  "output": 1.25},
    "sonnet":     {"input": 3.00,  "output": 15.00},
    "opus":       {"input": 15.00, "output": 75.00},
}

_client: Optional[AsyncAnthropic] = None


def get_client() -> AsyncAnthropic:
    global _client
    if _client is None:
        _client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY or "dummy-key")
    return _client


def calc_cost(model_key: str, input_tokens: int, output_tokens: int) -> float:
    rates = COST_PER_MTK.get(model_key, COST_PER_MTK["haiku"])
    return (input_tokens * rates["input"] + output_tokens * rates["output"]) / 1_000_000


async def stream_chat(
    messages: list[dict],
    model_key: str = "haiku",
    max_tokens: int = 1024,
    system: str = "",
) -> AsyncGenerator[dict, None]:
    """
    يُعيد generator يُنتج:
      {"text": "..."} أثناء الـ streaming
      {"done": True, "input_tokens": N, "output_tokens": N, "cost_usd": N} في النهاية
    في حالة الخطأ: {"error": "..."}
    """
    if not settings.ANTHROPIC_API_KEY:
        # وضع المحاكاة للتطوير
        mock_text = (
            "**مرحباً!** أنا مساعد Saqr Security الذكي.\n\n"
            "لاحظت أنك تعمل في بيئة تطوير بدون مفتاح Anthropic.\n\n"
            "لتفعيل الذكاء الاصطناعي الحقيقي، أضف `ANTHROPIC_API_KEY` في ملف `.env`.\n\n"
            "يمكنني مساعدتك في:\n"
            "- تفسير نتائج الفحوصات الأمنية\n"
            "- شرح الثغرات وكيفية إصلاحها\n"
            "- نصائح الامتثال (NCA ECC, SAMA CSF, PDPL)\n"
            "- كتابة كود آمن\n"
        )
        words = mock_text.split(" ")
        import asyncio
        for i, word in enumerate(words):
            await asyncio.sleep(0.04)
            yield {"text": word + (" " if i < len(words) - 1 else "")}
        yield {"done": True, "input_tokens": 50, "output_tokens": len(words), "cost_usd": 0.0}
        return

    model_id = ANTHROPIC_MODELS.get(model_key, ANTHROPIC_MODELS["haiku"])
    input_tokens = 0
    output_tokens = 0

    try:
        kwargs: dict = dict(
            model=model_id,
            max_tokens=max_tokens,
            messages=messages,
        )
        if system:
            kwargs["system"] = system

        async with get_client().messages.stream(**kwargs) as stream:
            async for text in stream.text_stream:
                yield {"text": text}

            final = await stream.get_final_message()
            input_tokens  = final.usage.input_tokens
            output_tokens = final.usage.output_tokens

        cost = calc_cost(model_key, input_tokens, output_tokens)
        yield {"done": True, "input_tokens": input_tokens, "output_tokens": output_tokens, "cost_usd": cost}

    except APIError as e:
        yield {"error": f"Anthropic API error: {e.message[:200]}"}
    except Exception as e:
        yield {"error": str(e)[:200]}
