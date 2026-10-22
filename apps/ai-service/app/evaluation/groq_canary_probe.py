import asyncio
import json

from app.config import get_settings
from app.llm.groq_provider import GroqModelProvider
from app.observability import DEFAULT_OBSERVABILITY


async def probe() -> dict[str, object]:
    settings = get_settings()
    if settings.app_env != "staging":
        raise RuntimeError("Groq canary probe is staging-only.")
    if not settings.groq_enabled or settings.primary_provider != "groq":
        raise RuntimeError("Groq canary probe requires the bounded Groq provider configuration.")
    if settings.gemini_enabled or settings.fallback_enabled:
        raise RuntimeError("Groq canary probe requires Gemini and fallback to remain disabled.")

    provider = GroqModelProvider(settings, DEFAULT_OBSERVABILITY)
    budget = provider.create_budget()
    before = await budget.snapshot()
    if before.consumed != 0:
        raise RuntimeError("Groq canary budget must start at zero.")

    client = provider.create_client()
    try:
        model = await client.models.retrieve(settings.groq_model)
    finally:
        await client.close()

    after = await budget.snapshot()
    if after.consumed != 1:
        raise RuntimeError("Groq metadata probe did not consume exactly one budget unit.")
    return {
        "provider": "groq",
        "requestedModel": settings.groq_model,
        "returnedModel": model.id,
        "modelMatched": model.id == settings.groq_model,
        "budgetConsumed": after.consumed,
        "budgetRemaining": after.remaining,
        "budgetLimit": after.limit,
    }


if __name__ == "__main__":
    print(json.dumps(asyncio.run(probe()), sort_keys=True))
