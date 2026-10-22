from typing import Any

import httpx
from groq import AsyncGroq, DefaultAsyncHttpxClient
from pydantic_ai.models.groq import GroqModel
from pydantic_ai.providers.groq import GroqProvider as PydanticGroqProvider

from app.config import Settings
from app.llm.provider_budget import ProviderRequestBudget
from app.observability import AiObservability


class BudgetedGroqHttpClient(DefaultAsyncHttpxClient):
    """Claims a durable budget unit immediately before every Groq HTTP send."""

    def __init__(self, budget: ProviderRequestBudget, **kwargs: Any) -> None:
        self._budget = budget
        super().__init__(**kwargs)

    async def send(self, request: httpx.Request, **kwargs: Any) -> httpx.Response:
        await self._budget.claim()
        return await super().send(request, **kwargs)


class GroqModelProvider:
    def __init__(self, settings: Settings, observability: AiObservability):
        self._settings = settings
        self._observability = observability

    def create_budget(self) -> ProviderRequestBudget:
        return ProviderRequestBudget(
            redis_url=self._settings.provider_budget_redis_url.get_secret_value(),
            environment=self._settings.app_env,
            provider="groq",
            model=self._settings.groq_model,
            canary_id=self._settings.provider_budget_canary_id,
            limit=self._settings.provider_budget_max_requests,
            ttl_seconds=self._settings.provider_budget_ttl_seconds,
            observability=self._observability,
        )

    def create_client(self) -> AsyncGroq:
        http_client = BudgetedGroqHttpClient(
            self.create_budget(),
            timeout=self._settings.llm_timeout_seconds,
        )
        return AsyncGroq(
            api_key=self._settings.groq_api_key.get_secret_value(),
            max_retries=0,
            timeout=self._settings.llm_timeout_seconds,
            http_client=http_client,
        )

    def create(self) -> GroqModel:
        client = self.create_client()
        return GroqModel(
            self._settings.groq_model,
            provider=PydanticGroqProvider(groq_client=client),
        )
