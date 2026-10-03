from functools import lru_cache
from typing import Literal

from pydantic import HttpUrl, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="AI_", extra="ignore")

    app_env: Literal["development", "test", "staging", "production"] = "development"
    api_base_url: HttpUrl = HttpUrl("http://localhost:4000")

    @model_validator(mode="after")
    def require_secure_production_api(self) -> "Settings":
        if self.app_env == "production" and self.api_base_url.scheme != "https":
            raise ValueError("Production API URL must use HTTPS.")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
