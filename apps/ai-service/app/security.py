import base64
import hashlib
import hmac
import time
from collections import OrderedDict

from fastapi import HTTPException, Request, status

from app.config import Settings


class NonceReplayCache:
    def __init__(self, capacity: int = 10_000):
        self._capacity = capacity
        self._entries: OrderedDict[str, int] = OrderedDict()

    def claim(self, nonce: str, expires_at: int, now: int) -> bool:
        while self._entries and next(iter(self._entries.values())) < now:
            self._entries.popitem(last=False)
        if nonce in self._entries:
            return False
        self._entries[nonce] = expires_at
        if len(self._entries) > self._capacity:
            self._entries.popitem(last=False)
        return True


async def verify_gateway_request(
    request: Request, settings: Settings, replay_cache: NonceReplayCache
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
    if not replay_cache.claim(nonce, issued_at + settings.internal_request_tolerance_seconds, now):
        raise _unauthorized()


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="AI service authentication failed.",
    )
