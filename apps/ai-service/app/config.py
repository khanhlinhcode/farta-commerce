import re
from functools import lru_cache
from typing import Literal

from pydantic import HttpUrl, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="AI_", extra="ignore")

    app_env: Literal["development", "test", "staging", "production"] = "development"
    enabled: bool = False
    api_base_url: HttpUrl = HttpUrl("http://localhost:4000")
    gateway_shared_secret: SecretStr = SecretStr("")
    tools_shared_secret: SecretStr = SecretStr("")
    internal_request_tolerance_seconds: int = 60

    gemini_enabled: bool = False
    gemini_free_tier_verified: bool = False
    gemini_api_key: SecretStr = SecretStr("")
    gemini_model: Literal["gemini-3.5-flash-lite"] = "gemini-3.5-flash-lite"
    groq_enabled: bool = False
    groq_free_tier_verified: bool = False
    groq_api_key: SecretStr = SecretStr("")
    groq_model: Literal["openai/gpt-oss-120b"] = "openai/gpt-oss-120b"
    primary_provider: Literal["gemini", "groq"] = "gemini"
    fallback_enabled: bool = False

    provider_budget_enabled: bool = False
    provider_budget_redis_url: SecretStr = SecretStr("")
    provider_budget_canary_id: str = ""
    provider_budget_max_requests: int = 7
    provider_budget_ttl_seconds: int = 86_400

    max_agent_iterations: int = 3
    max_tool_executions: int = 3
    max_history_turns: int = 6
    output_token_limit: int = 768
    request_timeout_seconds: float = 60.0
    llm_timeout_seconds: float = 25.0
    tool_timeout_seconds: float = 6.0

    @model_validator(mode="after")
    def validate_security_and_limits(self) -> "Settings":
        if self.app_env in {"staging", "production"} and self.api_base_url.scheme != "https":
            raise ValueError("Deployed-environment API URL must use HTTPS.")
        if not 1 <= self.max_agent_iterations <= 3:
            raise ValueError("Agent iterations must be between 1 and 3.")
        if not 1 <= self.max_tool_executions <= 3:
            raise ValueError("Tool executions must be between 1 and 3.")
        if not 1 <= self.max_history_turns <= 6:
            raise ValueError("Conversation history must contain at most 6 turns.")
        if not 128 <= self.output_token_limit <= 768:
            raise ValueError("Output token limit must be between 128 and 768.")
        if not 1 <= self.llm_timeout_seconds <= 25:
            raise ValueError("LLM timeout must be between 1 and 25 seconds.")
        if not 1 <= self.request_timeout_seconds <= 60:
            raise ValueError("Request timeout must be between 1 and 60 seconds.")
        if self.enabled:
            self._require_secret(self.gateway_shared_secret, "gateway shared secret")
            self._require_secret(self.tools_shared_secret, "tools shared secret")
        self._validate_provider(
            self.gemini_enabled,
            self.gemini_free_tier_verified,
            self.gemini_api_key,
            "Gemini",
        )
        self._validate_provider(
            self.groq_enabled,
            self.groq_free_tier_verified,
            self.groq_api_key,
            "Groq",
        )
        if self.fallback_enabled:
            raise ValueError("Automatic provider fallback is disabled for the Phase 6 validation.")
        if self.provider_budget_enabled:
            redis_url = self.provider_budget_redis_url.get_secret_value()
            if not redis_url.startswith(("redis://", "rediss://")):
                raise ValueError("Provider budget Redis URL must use redis:// or rediss://.")
            if not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9._-]{7,79}", self.provider_budget_canary_id):
                raise ValueError("Provider budget canary ID is invalid.")
            if not 1 <= self.provider_budget_max_requests <= 7:
                raise ValueError("Provider request budget must be between 1 and 7.")
            if not 300 <= self.provider_budget_ttl_seconds <= 86_400:
                raise ValueError(
                    "Provider request budget TTL must be between 300 and 86400 seconds."
                )
        if self.groq_enabled:
            if self.primary_provider != "groq":
                raise ValueError("Groq canary requires Groq as the primary provider.")
            if self.gemini_enabled:
                raise ValueError("Gemini must remain disabled during the Groq canary.")
            if not self.provider_budget_enabled:
                raise ValueError("Groq cannot be enabled without a provider request budget.")
            if self.max_agent_iterations > 2 or self.max_tool_executions > 1:
                raise ValueError(
                    "Groq canary permits at most two model requests and one tool call."
                )
        return self

    @staticmethod
    def _require_secret(secret: SecretStr, name: str) -> None:
        if len(secret.get_secret_value()) < 32:
            raise ValueError(f"AI {name} must contain at least 32 characters.")

    @classmethod
    def _validate_provider(
        cls,
        enabled: bool,
        free_tier_verified: bool,
        api_key: SecretStr,
        name: str,
    ) -> None:
        if not enabled:
            return
        if not free_tier_verified:
            raise ValueError(f"{name} cannot be enabled before free-tier verification.")
        cls._require_secret(api_key, f"{name} API key")


@lru_cache
def get_settings() -> Settings:
    return Settings()
