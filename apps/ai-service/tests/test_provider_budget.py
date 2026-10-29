import asyncio

import httpx
import pytest
from groq import APIConnectionError, AsyncGroq

from app.agents.executor import AgentExecutor
from app.llm.groq_provider import BudgetedGroqHttpClient
from app.llm.provider_budget import ProviderBudgetExceeded, ProviderRequestBudget
from app.observability import AiMetrics, AiObservability

pytestmark = pytest.mark.anyio


class FakeRedis:
    def __init__(self) -> None:
        self.values: dict[str, int] = {}
        self.expiries: dict[str, int] = {}
        self.claim_keys: list[str] = []
        self._lock = asyncio.Lock()

    async def eval(self, _script: str, _numkeys: int, *keys_and_args: object) -> object:
        key = str(keys_and_args[0])
        limit = int(keys_and_args[1])
        ttl_seconds = int(keys_and_args[2])
        async with self._lock:
            self.claim_keys.append(key)
            if key not in self.values:
                self.values[key] = 1
                self.expiries[key] = ttl_seconds
                return [1, 1, ttl_seconds]
            consumed = self.values[key]
            if consumed >= limit:
                return [0, consumed, self.expiries[key]]
            consumed += 1
            self.values[key] = consumed
            return [1, consumed, self.expiries[key]]

    async def get(self, key: str) -> object:
        return self.values.get(key)

    async def ttl(self, key: str) -> int:
        return self.expiries.get(key, -2)

    async def aclose(self) -> None:
        return None


def budget(
    backend: FakeRedis,
    *,
    limit: int = 3,
    model: str = "openai/gpt-oss-120b",
    canary_id: str = "groq-canary-20261022",
) -> ProviderRequestBudget:
    def factory(_url: str) -> FakeRedis:
        return backend

    return ProviderRequestBudget(
        redis_url="redis://test:6379/0",
        environment="staging",
        provider="groq",
        model=model,
        canary_id=canary_id,
        limit=limit,
        ttl_seconds=3_600,
        observability=AiObservability(metrics=AiMetrics()),
        redis_factory=factory,
    )


async def test_budget_permits_exactly_n_claims_and_rejects_n_plus_one() -> None:
    provider_budget = budget(FakeRedis(), limit=3)

    assert (await provider_budget.claim()).consumed == 1
    assert (await provider_budget.claim()).consumed == 2
    final = await provider_budget.claim()
    assert final.consumed == 3
    assert final.remaining == 0

    with pytest.raises(ProviderBudgetExceeded):
        await provider_budget.claim()


async def test_concurrent_claims_never_exceed_limit() -> None:
    backend = FakeRedis()
    provider_budget = budget(backend, limit=7)

    results = await asyncio.gather(
        *(provider_budget.claim() for _ in range(40)),
        return_exceptions=True,
    )

    accepted = [result for result in results if not isinstance(result, BaseException)]
    rejected = [result for result in results if isinstance(result, ProviderBudgetExceeded)]
    assert len(accepted) == 7
    assert len(rejected) == 33
    assert max(result.consumed for result in accepted) == 7
    assert next(iter(backend.values.values())) == 7


async def test_counter_binds_environment_provider_model_and_canary_with_ttl() -> None:
    backend = FakeRedis()
    first = budget(backend, model="openai/gpt-oss-120b", canary_id="groq-canary-a")
    second = budget(backend, model="openai/gpt-oss-20b", canary_id="groq-canary-a")
    third = budget(backend, model="openai/gpt-oss-120b", canary_id="groq-canary-b")

    first_claim = await first.claim()
    await second.claim()
    await third.claim()

    assert first_claim.ttl_seconds == 3_600
    assert len(set(backend.claim_keys)) == 3
    assert set(backend.expiries.values()) == {3_600}


async def test_snapshot_does_not_create_or_reset_counter() -> None:
    backend = FakeRedis()
    provider_budget = budget(backend, limit=2)

    assert (await provider_budget.snapshot()).consumed == 0
    assert backend.values == {}
    await provider_budget.claim()
    assert (await provider_budget.snapshot()).consumed == 1
    assert next(iter(backend.values.values())) == 1


async def test_http_client_rejects_before_network_transmission() -> None:
    backend = FakeRedis()
    provider_budget = budget(backend, limit=1)
    network_requests = 0

    async def handler(_request: httpx.Request) -> httpx.Response:
        nonlocal network_requests
        network_requests += 1
        return httpx.Response(200, json={"ok": True})

    async with BudgetedGroqHttpClient(
        provider_budget,
        transport=httpx.MockTransport(handler),
    ) as client:
        response = await client.get("https://api.groq.com/openai/v1/models")
        assert response.status_code == 200
        with pytest.raises(ProviderBudgetExceeded):
            await client.get("https://api.groq.com/openai/v1/models")

    assert network_requests == 1


async def test_pilot_enforces_minute_and_daily_caps_before_network() -> None:
    backend = FakeRedis()
    daily = budget(backend, limit=30, canary_id="groq-pilot-20261029")
    minute = budget(backend, limit=5, canary_id="groq-pilot-20261029.minute")
    network_requests = 0

    async def handler(_request: httpx.Request) -> httpx.Response:
        nonlocal network_requests
        network_requests += 1
        return httpx.Response(200, json={"ok": True})

    async with BudgetedGroqHttpClient(
        daily, minute_budget=minute, transport=httpx.MockTransport(handler)
    ) as client:
        for _ in range(5):
            assert (await client.get("https://api.groq.com/openai/v1/models")).status_code == 200
        with pytest.raises(ProviderBudgetExceeded):
            await client.get("https://api.groq.com/openai/v1/models")

    assert network_requests == 5
    assert (await daily.snapshot()).consumed == 5
    assert (await minute.snapshot()).consumed == 5


async def test_sdk_wraps_budget_exhaustion_without_losing_safe_error_mapping() -> None:
    backend = FakeRedis()
    provider_budget = budget(backend, limit=1)
    await provider_budget.claim()
    network_requests = 0

    async def handler(_request: httpx.Request) -> httpx.Response:
        nonlocal network_requests
        network_requests += 1
        return httpx.Response(200, json={"data": []})

    http_client = BudgetedGroqHttpClient(
        provider_budget,
        transport=httpx.MockTransport(handler),
    )
    client = AsyncGroq(api_key="test-key", max_retries=0, http_client=http_client)
    with pytest.raises(APIConnectionError) as exc_info:
        await client.models.list()
    await client.close()

    assert network_requests == 0
    assert AgentExecutor._provider_error_code(exc_info.value) == "AI_PROVIDER_BUDGET_EXCEEDED"
