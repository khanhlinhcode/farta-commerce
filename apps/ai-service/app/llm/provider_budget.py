import hashlib
from collections.abc import Callable
from dataclasses import dataclass
from typing import Protocol, cast

from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.observability import AiObservability


class ProviderBudgetExceeded(RuntimeError):
    """Raised before an outbound provider request when its canary budget is exhausted."""


class ProviderBudgetUnavailable(RuntimeError):
    """Raised when the durable budget cannot be checked safely."""


@dataclass(frozen=True)
class ProviderBudgetSnapshot:
    consumed: int
    remaining: int
    limit: int
    ttl_seconds: int


class AsyncRedisClient(Protocol):
    async def eval(self, script: str, numkeys: int, *keys_and_args: object) -> object: ...

    async def get(self, key: str) -> object: ...

    async def ttl(self, key: str) -> int: ...

    async def aclose(self) -> None: ...


RedisFactory = Callable[[str], AsyncRedisClient]


def _redis_factory(url: str) -> AsyncRedisClient:
    return cast(AsyncRedisClient, Redis.from_url(url, decode_responses=True))


class ProviderRequestBudget:
    """Durable, fail-closed provider HTTP request budget backed by one Redis key."""

    _CLAIM_SCRIPT = """
local current = redis.call('GET', KEYS[1])
if current then
  local ttl = redis.call('TTL', KEYS[1])
  if ttl < 0 then
    return {-1, tonumber(current), ttl}
  end
  if tonumber(current) >= tonumber(ARGV[1]) then
    return {0, tonumber(current), ttl}
  end
  local consumed = redis.call('INCR', KEYS[1])
  return {1, consumed, ttl}
end
redis.call('SET', KEYS[1], 1, 'EX', ARGV[2], 'NX')
return {1, 1, tonumber(ARGV[2])}
""".strip()

    def __init__(
        self,
        *,
        redis_url: str,
        environment: str,
        provider: str,
        model: str,
        canary_id: str,
        limit: int,
        ttl_seconds: int,
        observability: AiObservability,
        redis_factory: RedisFactory = _redis_factory,
    ) -> None:
        identity = "\0".join((environment, provider, model, canary_id))
        identity_digest = hashlib.sha256(identity.encode()).hexdigest()
        self._key = f"farta:ai:provider-budget:v1:{identity_digest}"
        self._canary_digest = hashlib.sha256(canary_id.encode()).hexdigest()[:16]
        self._redis_url = redis_url
        self._provider = provider
        self._model = model
        self._limit = limit
        self._ttl_seconds = ttl_seconds
        self._observability = observability
        self._redis_factory = redis_factory

    async def claim(self) -> ProviderBudgetSnapshot:
        client = self._redis_factory(self._redis_url)
        try:
            raw = await client.eval(
                self._CLAIM_SCRIPT,
                1,
                self._key,
                self._limit,
                self._ttl_seconds,
            )
        except RedisError as error:
            self._emit_failure("AI_PROVIDER_BUDGET_UNAVAILABLE")
            raise ProviderBudgetUnavailable("Provider request budget is unavailable.") from error
        finally:
            await client.aclose()

        status, consumed, ttl_seconds = self._parse_claim(raw)
        snapshot = self._snapshot(consumed, ttl_seconds)
        if status == 1:
            self._observability.emit(
                "ai.provider.budget.claimed",
                provider=self._provider,
                model=self._model,
                canary_digest=self._canary_digest,
                budget_consumed=snapshot.consumed,
                budget_remaining=snapshot.remaining,
                budget_limit=snapshot.limit,
                budget_ttl_seconds=snapshot.ttl_seconds,
            )
            return snapshot
        if status == 0:
            self._observability.emit(
                "ai.provider.budget.exceeded",
                provider=self._provider,
                model=self._model,
                canary_digest=self._canary_digest,
                budget_consumed=snapshot.consumed,
                budget_remaining=0,
                budget_limit=snapshot.limit,
                budget_ttl_seconds=snapshot.ttl_seconds,
                error_code="AI_PROVIDER_BUDGET_EXCEEDED",
            )
            raise ProviderBudgetExceeded("Provider request budget is exhausted.")
        self._emit_failure("AI_PROVIDER_BUDGET_UNAVAILABLE")
        raise ProviderBudgetUnavailable("Provider request budget has no safe expiry.")

    async def snapshot(self) -> ProviderBudgetSnapshot:
        client = self._redis_factory(self._redis_url)
        try:
            raw_consumed = await client.get(self._key)
            if raw_consumed is None:
                return self._snapshot(0, 0)
            ttl_seconds = await client.ttl(self._key)
        except RedisError as error:
            self._emit_failure("AI_PROVIDER_BUDGET_UNAVAILABLE")
            raise ProviderBudgetUnavailable("Provider request budget is unavailable.") from error
        finally:
            await client.aclose()
        if ttl_seconds < 0:
            self._emit_failure("AI_PROVIDER_BUDGET_UNAVAILABLE")
            raise ProviderBudgetUnavailable("Provider request budget has no safe expiry.")
        try:
            consumed = int(cast(str | bytes | int, raw_consumed))
        except (TypeError, ValueError) as error:
            self._emit_failure("AI_PROVIDER_BUDGET_UNAVAILABLE")
            raise ProviderBudgetUnavailable("Provider request budget is invalid.") from error
        return self._snapshot(consumed, ttl_seconds)

    def _snapshot(self, consumed: int, ttl_seconds: int) -> ProviderBudgetSnapshot:
        return ProviderBudgetSnapshot(
            consumed=consumed,
            remaining=max(0, self._limit - consumed),
            limit=self._limit,
            ttl_seconds=max(0, ttl_seconds),
        )

    @staticmethod
    def _parse_claim(raw: object) -> tuple[int, int, int]:
        if not isinstance(raw, (list, tuple)) or len(raw) != 3:
            raise ProviderBudgetUnavailable("Provider request budget returned an invalid result.")
        try:
            return int(raw[0]), int(raw[1]), int(raw[2])
        except (TypeError, ValueError) as error:
            raise ProviderBudgetUnavailable(
                "Provider request budget returned an invalid result."
            ) from error

    def _emit_failure(self, error_code: str) -> None:
        self._observability.emit(
            "ai.provider.budget.failed",
            provider=self._provider,
            model=self._model,
            canary_digest=self._canary_digest,
            budget_limit=self._limit,
            error_code=error_code,
        )
