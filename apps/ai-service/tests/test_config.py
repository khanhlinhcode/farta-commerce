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
