from functools import lru_cache
from typing import Literal

from pydantic import HttpUrl, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="AI_", extra="ignore")

    app_env: Literal["development", "test", "staging", "production"] = "development"
    api_base_url: HttpUrl = HttpUrl("http://localhost:4000")

    @model_validator(mode="after")
    def require_secure_deployed_api(self) -> "Settings":
        if self.app_env in {"staging", "production"} and self.api_base_url.scheme != "https":
            raise ValueError("Deployed-environment API URL must use HTTPS.")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
