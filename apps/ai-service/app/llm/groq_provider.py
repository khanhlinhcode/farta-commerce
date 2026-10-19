from groq import AsyncGroq
from pydantic_ai.models.groq import GroqModel
from pydantic_ai.providers.groq import GroqProvider as PydanticGroqProvider

from app.config import Settings


class GroqModelProvider:
    def __init__(self, settings: Settings):
        self._settings = settings

    def create(self) -> GroqModel:
        client = AsyncGroq(
            api_key=self._settings.groq_api_key.get_secret_value(),
            max_retries=0,
            timeout=self._settings.llm_timeout_seconds,
        )
        return GroqModel(
            self._settings.groq_model,
            provider=PydanticGroqProvider(groq_client=client),
        )
