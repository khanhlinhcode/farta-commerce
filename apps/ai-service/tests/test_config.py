import pytest
from pydantic import ValidationError

from app.config import Settings


@pytest.mark.parametrize("app_env", ["staging", "production"])
def test_deployed_environment_requires_https_api(app_env: str) -> None:
    with pytest.raises(ValidationError):
        Settings(app_env=app_env, api_base_url="http://api.example")


@pytest.mark.parametrize("app_env", ["staging", "production"])
def test_deployed_environment_accepts_https_api(app_env: str) -> None:
    settings = Settings(app_env=app_env, api_base_url="https://api.example")
    assert settings.api_base_url.scheme == "https"


@pytest.mark.parametrize("app_env", ["development", "test"])
def test_local_environment_accepts_http_api(app_env: str) -> None:
    settings = Settings(app_env=app_env, api_base_url="http://localhost:4000")
    assert settings.api_base_url.scheme == "http"


def test_enabled_service_requires_distinct_internal_secrets() -> None:
    with pytest.raises(ValidationError, match="gateway shared secret"):
        Settings(enabled=True)
    settings = Settings(
        enabled=True,
        gateway_shared_secret="g" * 32,
        tools_shared_secret="t" * 32,
        provider_budget_redis_url="redis://localhost:6379/0",
    )
    assert settings.enabled is True


def test_enabled_service_requires_shared_replay_redis() -> None:
    with pytest.raises(ValidationError, match="Shared replay/provider budget Redis URL"):
        Settings(
            enabled=True,
            gateway_shared_secret="g" * 32,
            tools_shared_secret="t" * 32,
        )


def test_provider_requires_explicit_free_tier_verification() -> None:
    with pytest.raises(ValidationError, match="free-tier verification"):
        Settings(gemini_enabled=True, gemini_api_key="g" * 32)


def test_only_approved_stable_gemini_model_is_accepted() -> None:
    assert Settings().gemini_model == "gemini-3.5-flash-lite"
    with pytest.raises(ValidationError):
        Settings(gemini_model="gemini-3.8-flash")


def test_automatic_provider_fallback_is_rejected() -> None:
    with pytest.raises(ValidationError, match="fallback is disabled"):
        Settings(fallback_enabled=True)


def test_rag_is_gated_for_staging_and_disabled_in_production() -> None:
    assert Settings().rag_enabled is False
    assert Settings(app_env="development", rag_enabled=True).rag_enabled is True
    with pytest.raises(ValidationError, match="explicit approval gate"):
        Settings(
            app_env="staging",
            api_base_url="https://api.example",
            rag_enabled=True,
        )
    assert (
        Settings(
            app_env="staging",
            api_base_url="https://api.example",
            rag_enabled=True,
            rag_staging_approved=True,
        ).rag_enabled
        is True
    )
    with pytest.raises(ValidationError, match="disabled in production"):
        Settings(
            app_env="production",
            api_base_url="https://api.example",
            rag_enabled=True,
        )
    with pytest.raises(ValidationError, match="valid only in staging"):
        Settings(app_env="development", rag_staging_approved=True)


def test_groq_requires_atomic_canary_budget_and_bounded_agent() -> None:
    provider = {
        "groq_enabled": True,
        "groq_free_tier_verified": True,
        "groq_api_key": "g" * 32,
        "primary_provider": "groq",
    }
    with pytest.raises(ValidationError, match="provider request budget"):
        Settings(**provider)

    budget = {
        "provider_budget_enabled": True,
        "provider_budget_redis_url": "redis://localhost:6379/0",
        "provider_budget_canary_id": "groq-canary-20261022",
    }
    with pytest.raises(ValidationError, match="two model requests and one tool call"):
        Settings(**provider, **budget)

    settings = Settings(
        **provider,
        **budget,
        max_agent_iterations=2,
        max_tool_executions=1,
    )
    assert settings.groq_model == "openai/gpt-oss-120b"
    assert settings.gemini_enabled is False
    assert settings.fallback_enabled is False


def test_provider_budget_configuration_is_bounded() -> None:
    common = {
        "provider_budget_enabled": True,
        "provider_budget_redis_url": "redis://localhost:6379/0",
        "provider_budget_canary_id": "groq-canary-20261022",
    }
    with pytest.raises(ValidationError, match="between 1 and 7"):
        Settings(**common, provider_budget_max_requests=8)
    with pytest.raises(ValidationError, match="canary ID"):
        Settings(**(common | {"provider_budget_canary_id": "unsafe id"}))
    with pytest.raises(ValidationError, match="Redis URL"):
        Settings(**(common | {"provider_budget_redis_url": "https://example.com"}))


def test_staging_pilot_requires_explicit_gate_and_daily_budget() -> None:
    common = {
        "api_base_url": "https://api-staging.example",
        "provider_budget_enabled": True,
        "provider_budget_redis_url": "redis://localhost:6379/0",
        "provider_budget_canary_id": "groq-pilot-20261029",
        "provider_budget_max_requests": 30,
        "provider_budget_ttl_seconds": 86_400,
    }
    with pytest.raises(ValidationError, match="between 1 and 7"):
        Settings(app_env="staging", **common)
    with pytest.raises(ValidationError, match="restricted to staging"):
        Settings(app_env="production", provider_pilot_approved=True, **common)
    with pytest.raises(ValidationError, match="dedicated budget ID"):
        Settings(
            app_env="staging",
            provider_pilot_approved=True,
            **(common | {"provider_budget_canary_id": "groq-canary-20261029"}),
        )
    with pytest.raises(ValidationError, match="86400 seconds"):
        Settings(
            app_env="staging",
            provider_pilot_approved=True,
            **(common | {"provider_budget_ttl_seconds": 3_600}),
        )
    with pytest.raises(ValidationError, match="between 1 and 30"):
        Settings(
            app_env="staging",
            provider_pilot_approved=True,
            **(common | {"provider_budget_max_requests": 31}),
        )
    settings = Settings(app_env="staging", provider_pilot_approved=True, **common)
    assert settings.provider_budget_max_requests == 30
    assert settings.provider_budget_ttl_seconds == 86_400


def test_live_agent_timeout_budget_is_bounded() -> None:
    settings = Settings()
    assert settings.llm_timeout_seconds == 25
    assert settings.request_timeout_seconds == 60
    with pytest.raises(ValidationError, match="LLM timeout"):
        Settings(llm_timeout_seconds=26)
    with pytest.raises(ValidationError, match="Request timeout"):
        Settings(request_timeout_seconds=61)
