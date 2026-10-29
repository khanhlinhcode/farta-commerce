from dataclasses import replace
from typing import Any

import httpx
from groq import AsyncGroq, DefaultAsyncHttpxClient
from pydantic_ai.models import ModelRequestParameters
from pydantic_ai.models.groq import GroqModel
from pydantic_ai.providers.groq import GroqProvider as PydanticGroqProvider
from pydantic_ai.settings import ModelSettings

from app.config import Settings
from app.llm.provider_budget import ProviderRequestBudget
from app.observability import AiObservability


class BudgetedGroqHttpClient(DefaultAsyncHttpxClient):
    """Claims a durable budget unit immediately before every Groq HTTP send."""

    def __init__(
        self,
        budget: ProviderRequestBudget,
        minute_budget: ProviderRequestBudget | None = None,
        **kwargs: Any,
    ) -> None:
        self._budget = budget
        self._minute_budget = minute_budget
        super().__init__(**kwargs)

    async def send(self, request: httpx.Request, **kwargs: Any) -> httpx.Response:
        if self._minute_budget is not None:
            await self._minute_budget.claim()
        await self._budget.claim()
        return await super().send(request, **kwargs)


class GroqTwoPhaseModel(GroqModel):
    """Keep Groq tool calling and native structured output on separate requests."""

    def prepare_request(
        self,
        model_settings: ModelSettings | None,
        model_request_parameters: ModelRequestParameters,
    ) -> tuple[ModelSettings | None, ModelRequestParameters]:
        settings, parameters = super().prepare_request(
            model_settings,
            model_request_parameters,
        )
        if parameters.declared_function_tools and parameters.output_mode == "native":
            # Groq does not support Structured Outputs and tool use in the same
            # request. The bounded first iteration only gathers catalog data;
            # the next iteration has no catalog tools and retains NativeOutput.
            parameters = replace(
                parameters,
                output_mode="text",
                output_object=None,
                prompted_output_template=None,
                allow_text_output=True,
            )
        return settings, parameters


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
        minute_budget = None
        if self._settings.provider_pilot_approved:
            minute_budget = ProviderRequestBudget(
                redis_url=self._settings.provider_budget_redis_url.get_secret_value(),
                environment=self._settings.app_env,
                provider="groq",
                model=self._settings.groq_model,
                canary_id=f"{self._settings.provider_budget_canary_id}.minute",
                limit=5,
                ttl_seconds=60,
                observability=self._observability,
            )
        http_client = BudgetedGroqHttpClient(
            self.create_budget(),
            minute_budget=minute_budget,
            timeout=self._settings.llm_timeout_seconds,
        )
        return AsyncGroq(
            api_key=self._settings.groq_api_key.get_secret_value(),
            max_retries=0,
            timeout=self._settings.llm_timeout_seconds,
            http_client=http_client,
        )

    def create(self) -> GroqTwoPhaseModel:
        client = self.create_client()
        return GroqTwoPhaseModel(
            self._settings.groq_model,
            provider=PydanticGroqProvider(groq_client=client),
        )
