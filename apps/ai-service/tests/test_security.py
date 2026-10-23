import asyncio
import base64
import hashlib
import hmac
import logging
import time
from collections.abc import Callable

import pytest
from fastapi import HTTPException
from redis.exceptions import RedisError
from starlette.requests import Request

from app.config import Settings
from app.security import RedisNonceReplayStore, verify_gateway_request


class SharedFakeRedis:
    def __init__(self, clock: Callable[[], float] | None = None) -> None:
        self._clock = clock or time.monotonic
        self._entries: dict[str, tuple[str, float]] = {}
        self._lock = asyncio.Lock()
        self.claim_keys: list[str] = []

    async def set(
        self,
        name: str,
        value: str,
        *,
        ex: int,
        nx: bool,
    ) -> object:
        assert nx is True
        async with self._lock:
            self.claim_keys.append(name)
            current = self._entries.get(name)
            if current is not None and current[1] <= self._clock():
                self._entries.pop(name)
                current = None
            if current is not None:
                return None
            self._entries[name] = (value, self._clock() + ex)
            return True

    async def aclose(self) -> None:
        return None


class FailingRedis:
    async def set(
        self,
        _name: str,
        _value: str,
        *,
        ex: int,
        nx: bool,
    ) -> object:
        raise RedisError("synthetic Redis failure")

    async def aclose(self) -> None:
        return None


class SpyReplayStore:
    def __init__(self, result: bool = True) -> None:
        self.calls: list[tuple[str, int]] = []
        self._result = result

    async def claim(self, nonce: str, ttl_seconds: int) -> bool:
        self.calls.append((nonce, ttl_seconds))
        return self._result


def replay_store(
    backend: SharedFakeRedis | FailingRedis,
    *,
    environment: str = "staging",
) -> RedisNonceReplayStore:
    return RedisNonceReplayStore(
        redis_url="redis://test:6379/0",
        environment=environment,
        redis_factory=lambda _url: backend,
    )


def settings() -> Settings:
    return Settings(
        enabled=True,
        gateway_shared_secret="g" * 32,
        tools_shared_secret="t" * 32,
        provider_budget_redis_url="redis://test:6379/0",
    )


def request_for(
    body: bytes,
    nonce: str,
    secret: str,
    timestamp: str | None = None,
    *,
    audience: str = "farta-ai-service",
    method: str = "POST",
    path: str = "/v1/chat",
    signed_method: str | None = None,
    signed_path: str | None = None,
) -> Request:
    issued_at = timestamp or str(int(time.time()))
    payload = b".".join(
        (
            issued_at.encode(),
            nonce.encode(),
            audience.encode(),
            (signed_method or method).encode(),
            (signed_path or path).encode(),
            body,
        )
    )
    signature = base64.urlsafe_b64encode(
        hmac.new(secret.encode(), payload, hashlib.sha256).digest()
    ).rstrip(b"=")
    headers = [
        (b"x-farta-ai-timestamp", issued_at.encode()),
        (b"x-farta-ai-nonce", nonce.encode()),
        (b"x-farta-ai-audience", audience.encode()),
        (b"x-farta-ai-signature", signature),
    ]
    sent = False

    async def receive() -> dict:
        nonlocal sent
        if sent:
            return {"type": "http.request", "body": b"", "more_body": False}
        sent = True
        return {"type": "http.request", "body": body, "more_body": False}

    return Request(
        {
            "type": "http",
            "method": method,
            "path": path,
            "query_string": b"",
            "headers": headers,
            "server": ("test", 80),
            "scheme": "http",
        },
        receive,
    )


@pytest.mark.anyio
async def test_first_nonce_claim_passes_and_duplicate_fails() -> None:
    backend = SharedFakeRedis()
    store = replay_store(backend)

    assert await store.claim("n" * 32, 60) is True
    assert await store.claim("n" * 32, 60) is False


@pytest.mark.anyio
async def test_concurrent_nonce_claims_permit_exactly_one_winner() -> None:
    backend = SharedFakeRedis()
    stores = [replay_store(backend) for _ in range(20)]

    results = await asyncio.gather(*(store.claim("c" * 32, 60) for store in stores))

    assert results.count(True) == 1
    assert results.count(False) == 19


@pytest.mark.anyio
async def test_expired_nonce_can_be_claimed_again() -> None:
    now = 100.0
    backend = SharedFakeRedis(clock=lambda: now)
    store = replay_store(backend)

    assert await store.claim("e" * 32, 2) is True
    assert await store.claim("e" * 32, 2) is False
    now = 103.0
    assert await store.claim("e" * 32, 2) is True


@pytest.mark.anyio
async def test_nonce_key_is_digest_namespaced_by_environment_and_boundary() -> None:
    nonce = "raw-nonce-must-not-be-stored-1234"
    backend = SharedFakeRedis()

    assert await replay_store(backend).claim(nonce, 60) is True

    [key] = backend.claim_keys
    assert key.startswith("farta:ai:replay:v1:staging:gateway-inbound:")
    assert nonce not in key
    assert key.endswith(hashlib.sha256(nonce.encode()).hexdigest())


@pytest.mark.anyio
async def test_gateway_signature_and_cross_replica_replay_protection() -> None:
    backend = SharedFakeRedis()
    first_replica = replay_store(backend)
    second_replica = replay_store(backend)
    nonce = "n" * 32

    await verify_gateway_request(
        request_for(b'{"message":"test"}', nonce, "g" * 32),
        settings(),
        first_replica,
    )
    with pytest.raises(HTTPException) as repeated:
        await verify_gateway_request(
            request_for(b'{"message":"test"}', nonce, "g" * 32),
            settings(),
            second_replica,
        )
    assert repeated.value.status_code == 401


@pytest.mark.anyio
async def test_replay_store_failure_fails_closed_without_sensitive_logs(
    caplog: pytest.LogCaptureFixture,
) -> None:
    nonce = "sensitive-nonce-12345678901234567"
    body = b'{"message":"private prompt"}'
    caplog.set_level(logging.WARNING)

    with pytest.raises(HTTPException) as unavailable:
        await verify_gateway_request(
            request_for(body, nonce, "g" * 32),
            settings(),
            replay_store(FailingRedis()),
        )

    assert unavailable.value.status_code == 503
    assert unavailable.value.detail == "AI_REPLAY_STORE_UNAVAILABLE"
    assert "AI_REPLAY_STORE_UNAVAILABLE" in caplog.text
    for forbidden in (nonce, "private prompt", "g" * 32, "x-farta-ai-signature"):
        assert forbidden not in caplog.text


@pytest.mark.anyio
async def test_invalid_signature_never_creates_replay_entry() -> None:
    replay = SpyReplayStore()

    with pytest.raises(HTTPException) as invalid:
        await verify_gateway_request(
            request_for(b"{}", "n" * 32, "x" * 32),
            settings(),
            replay,
        )

    assert invalid.value.status_code == 401
    assert replay.calls == []


@pytest.mark.anyio
@pytest.mark.parametrize(
    "signed_request",
    [
        request_for(b"{}", "a" * 32, "g" * 32, audience="wrong-audience"),
        request_for(b"{}", "b" * 32, "g" * 32, timestamp="1"),
        request_for(b"{}", "c" * 32, "g" * 32, signed_method="GET"),
        request_for(b"{}", "d" * 32, "g" * 32, signed_path="/wrong-path"),
    ],
)
async def test_gateway_rejects_wrong_binding_and_expired_requests(
    signed_request: Request,
) -> None:
    replay = SpyReplayStore()

    with pytest.raises(HTTPException) as rejected:
        await verify_gateway_request(signed_request, settings(), replay)

    assert rejected.value.status_code == 401
    assert replay.calls == []
