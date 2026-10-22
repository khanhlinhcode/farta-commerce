from types import SimpleNamespace
from typing import Any

import pytest

from app.evaluation import groq_canary_probe
from app.llm.provider_budget import ProviderBudgetSnapshot

pytestmark = pytest.mark.anyio


class FakeBudget:
    def __init__(self) -> None:
        self.consumed = 0

    async def snapshot(self) -> ProviderBudgetSnapshot:
        return ProviderBudgetSnapshot(
            consumed=self.consumed,
            remaining=7 - self.consumed,
            limit=7,
            ttl_seconds=0 if self.consumed == 0 else 3_600,
        )


class FakeModels:
    def __init__(self, budget: FakeBudget, model_ids: list[str]) -> None:
        self._budget = budget
        self._model_ids = model_ids
        self.list_calls = 0

    async def list(self) -> SimpleNamespace:
        self.list_calls += 1
        self._budget.consumed += 1
        return SimpleNamespace(data=[SimpleNamespace(id=model_id) for model_id in self._model_ids])

    async def retrieve(self, _model: str) -> None:
        raise AssertionError("The canary must not use a namespaced model ID as one path segment.")


class FakeClient:
    def __init__(self, budget: FakeBudget, model_ids: list[str]) -> None:
        self.models = FakeModels(budget, model_ids)
        self.closed = False

    async def close(self) -> None:
        self.closed = True


class FakeProvider:
    def __init__(self, budget: FakeBudget, client: FakeClient) -> None:
        self._budget = budget
        self._client = client

    def create_budget(self) -> FakeBudget:
        return self._budget

    def create_client(self) -> FakeClient:
        return self._client


def settings() -> SimpleNamespace:
    return SimpleNamespace(
        app_env="staging",
        groq_enabled=True,
        primary_provider="groq",
        gemini_enabled=False,
        fallback_enabled=False,
        groq_model="openai/gpt-oss-120b",
    )


async def test_probe_lists_models_and_matches_namespaced_id(monkeypatch: Any) -> None:
    fake_budget = FakeBudget()
    fake_client = FakeClient(fake_budget, ["openai/gpt-oss-20b", "openai/gpt-oss-120b"])
    fake_provider = FakeProvider(fake_budget, fake_client)
    monkeypatch.setattr(groq_canary_probe, "get_settings", settings)
    monkeypatch.setattr(
        groq_canary_probe,
        "GroqModelProvider",
        lambda _settings, _observability: fake_provider,
    )

    result = await groq_canary_probe.probe()

    assert result["requestedModel"] == "openai/gpt-oss-120b"
    assert result["returnedModel"] == "openai/gpt-oss-120b"
    assert result["modelMatched"] is True
    assert result["budgetConsumed"] == 1
    assert result["budgetRemaining"] == 6
    assert fake_client.models.list_calls == 1
    assert fake_client.closed is True


async def test_probe_fails_closed_when_exact_model_id_is_missing(monkeypatch: Any) -> None:
    fake_budget = FakeBudget()
    fake_client = FakeClient(fake_budget, ["openai/gpt-oss-20b"])
    fake_provider = FakeProvider(fake_budget, fake_client)
    monkeypatch.setattr(groq_canary_probe, "get_settings", settings)
    monkeypatch.setattr(
        groq_canary_probe,
        "GroqModelProvider",
        lambda _settings, _observability: fake_provider,
    )

    with pytest.raises(RuntimeError, match="not available"):
        await groq_canary_probe.probe()

    assert fake_client.models.list_calls == 1
    assert fake_client.closed is True
