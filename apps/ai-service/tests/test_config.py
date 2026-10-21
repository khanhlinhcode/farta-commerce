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
    )
    assert settings.enabled is True


def test_provider_requires_explicit_free_tier_verification() -> None:
    with pytest.raises(ValidationError, match="free-tier verification"):
        Settings(gemini_enabled=True, gemini_api_key="g" * 32)


def test_automatic_provider_fallback_is_rejected() -> None:
    with pytest.raises(ValidationError, match="fallback is disabled"):
        Settings(fallback_enabled=True)


def test_live_agent_timeout_budget_is_bounded() -> None:
    settings = Settings()
    assert settings.llm_timeout_seconds == 25
    assert settings.request_timeout_seconds == 60
    with pytest.raises(ValidationError, match="LLM timeout"):
        Settings(llm_timeout_seconds=26)
    with pytest.raises(ValidationError, match="Request timeout"):
        Settings(request_timeout_seconds=61)
