import base64
import hashlib
import hmac
import json
import secrets
import time

import httpx
import pytest

from app.api.chat import get_replay_store
from app.config import Settings, get_settings
from app.main import app

SECRET = "g" * 32


class AllowReplayStore:
    async def claim(self, _nonce: str, _ttl_seconds: int) -> bool:
        return True


def signed_headers(body: bytes) -> dict[str, str]:
    timestamp = str(int(time.time()))
    nonce = secrets.token_urlsafe(32)
    audience = "farta-ai-service"
    payload = b".".join(
        (
            timestamp.encode(),
            nonce.encode(),
            audience.encode(),
            b"POST",
            b"/v1/chat",
            body,
        )
    )
    signature = base64.urlsafe_b64encode(
        hmac.new(SECRET.encode(), payload, hashlib.sha256).digest()
    ).rstrip(b"=")
    return {
        "content-type": "application/json",
        "x-farta-ai-timestamp": timestamp,
        "x-farta-ai-nonce": nonce,
        "x-farta-ai-audience": audience,
        "x-farta-ai-signature": signature.decode(),
    }


@pytest.fixture(autouse=True)
def enabled_settings() -> None:
    app.dependency_overrides[get_settings] = lambda: Settings(
        enabled=True,
        gateway_shared_secret=SECRET,
        tools_shared_secret="t" * 32,
        provider_budget_redis_url="redis://test:6379/0",
    )
    app.dependency_overrides[get_replay_store] = AllowReplayStore
    yield
    app.dependency_overrides.clear()


@pytest.mark.anyio
async def test_chat_rejects_unsigned_internal_request() -> None:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/v1/chat", json={})
    assert response.status_code == 401


@pytest.mark.anyio
async def test_chat_returns_typed_read_only_scope_response() -> None:
    payload = {
        "requestId": "request-12345678",
        "conversationId": "00000000-0000-4000-8000-000000000001",
        "message": "Kiểm tra đơn hàng của tôi",
        "history": [],
        "selectedProductSlugs": [],
    }
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/v1/chat", content=body, headers=signed_headers(body))
    assert response.status_code == 200
    assert response.json()["error"]["code"] == "AI_SCOPE_UNSUPPORTED"
    assert response.json()["products"] == []
