from google.genai.types import HttpRetryOptions
from pydantic_ai.models.google import GoogleModel
from pydantic_ai.providers.google import GoogleProvider

from app.config import Settings


class GeminiProvider:
    def __init__(self, settings: Settings):
        self._settings = settings

    def create(self) -> GoogleModel:
        provider = GoogleProvider(
            api_key=self._settings.gemini_api_key.get_secret_value(),
            retry_options=HttpRetryOptions(attempts=1),
        )
        return GoogleModel(self._settings.gemini_model, provider=provider)
