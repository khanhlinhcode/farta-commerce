import base64
import hashlib
import hmac
import logging
import time
from collections.abc import Callable
from typing import Protocol, cast

from fastapi import HTTPException, Request, status
from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.config import Settings

logger = logging.getLogger(__name__)


class ReplayStoreUnavailable(RuntimeError):
    """Raised when the shared inbound replay boundary cannot be checked safely."""


class NonceReplayStore(Protocol):
    async def claim(self, nonce: str, ttl_seconds: int) -> bool: ...


class AsyncRedisClient(Protocol):
    async def set(
        self,
        name: str,
        value: str,
        *,
        ex: int,
        nx: bool,
    ) -> object: ...

    async def aclose(self) -> None: ...


RedisFactory = Callable[[str], AsyncRedisClient]


def _redis_factory(url: str) -> AsyncRedisClient:
    return cast(AsyncRedisClient, Redis.from_url(url, decode_responses=True))


class RedisNonceReplayStore:
    """Shared, fail-closed nonce claims for the inbound NestJS gateway boundary."""

    def __init__(
        self,
        *,
        redis_url: str,
        environment: str,
        boundary: str = "gateway-inbound",
        redis_factory: RedisFactory = _redis_factory,
    ) -> None:
        self._redis_url = redis_url
        self._key_prefix = f"farta:ai:replay:v1:{environment}:{boundary}"
        self._redis_factory = redis_factory

    async def claim(self, nonce: str, ttl_seconds: int) -> bool:
        nonce_digest = hashlib.sha256(nonce.encode()).hexdigest()
        key = f"{self._key_prefix}:{nonce_digest}"
        client: AsyncRedisClient | None = None
        try:
            client = self._redis_factory(self._redis_url)
            claimed = await client.set(key, "1", ex=max(1, ttl_seconds), nx=True)
        except (RedisError, OSError, ValueError) as error:
            logger.warning("AI_REPLAY_STORE_UNAVAILABLE")
            raise ReplayStoreUnavailable("Inbound replay protection is unavailable.") from error
        finally:
            if client is not None:
                try:
                    await client.aclose()
                except RedisError:
                    logger.warning("AI_REPLAY_STORE_CLOSE_FAILED")
        return claimed is True


async def verify_gateway_request(
    request: Request, settings: Settings, replay_store: NonceReplayStore
) -> None:
    if not settings.enabled or len(settings.gateway_shared_secret.get_secret_value()) < 32:
        raise _unauthorized()
    timestamp = request.headers.get("x-farta-ai-timestamp", "")
    nonce = request.headers.get("x-farta-ai-nonce", "")
    audience = request.headers.get("x-farta-ai-audience", "")
    signature = request.headers.get("x-farta-ai-signature", "")
    if (
        audience != "farta-ai-service"
        or not timestamp.isdigit()
        or not 32 <= len(nonce) <= 64
        or not all(character.isalnum() or character in "_-" for character in nonce)
    ):
        raise _unauthorized()
    issued_at = int(timestamp)
    if abs(int(time.time()) - issued_at) > settings.internal_request_tolerance_seconds:
        raise _unauthorized()
    body = await request.body()
    payload = b".".join(
        (
            timestamp.encode(),
            nonce.encode(),
            audience.encode(),
            request.method.upper().encode(),
            request.url.path.encode(),
            body,
        )
    )
    digest = hmac.new(
        settings.gateway_shared_secret.get_secret_value().encode(), payload, hashlib.sha256
    ).digest()
    expected = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    if not hmac.compare_digest(signature, expected):
        raise _unauthorized()
    now = int(time.time())
    ttl_seconds = issued_at + settings.internal_request_tolerance_seconds - now
    try:
        claimed = await replay_store.claim(nonce, max(1, ttl_seconds))
    except ReplayStoreUnavailable as error:
        raise _replay_unavailable() from error
    if not claimed:
        raise _unauthorized()


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="AI service authentication failed.",
    )


def _replay_unavailable() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="AI_REPLAY_STORE_UNAVAILABLE",
    )
