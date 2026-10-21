import base64
import hashlib
import hmac
import time

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app.config import Settings
from app.security import NonceReplayCache, verify_gateway_request


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
async def test_gateway_signature_and_replay_protection() -> None:
    secret = "g" * 32
    settings = Settings(
        enabled=True,
        gateway_shared_secret=secret,
        tools_shared_secret="t" * 32,
    )
    replay = NonceReplayCache()
    nonce = "n" * 32
    await verify_gateway_request(
        request_for(b'{"message":"test"}', nonce, secret), settings, replay
    )
    with pytest.raises(HTTPException) as repeated:
        await verify_gateway_request(
            request_for(b'{"message":"test"}', nonce, secret), settings, replay
        )
    assert repeated.value.status_code == 401


@pytest.mark.anyio
async def test_gateway_rejects_invalid_signature() -> None:
    settings = Settings(
        enabled=True,
        gateway_shared_secret="g" * 32,
        tools_shared_secret="t" * 32,
    )
    with pytest.raises(HTTPException) as invalid:
        await verify_gateway_request(
            request_for(b"{}", "n" * 32, "x" * 32), settings, NonceReplayCache()
        )
    assert invalid.value.status_code == 401


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
    settings = Settings(
        enabled=True,
        gateway_shared_secret="g" * 32,
        tools_shared_secret="t" * 32,
    )
    with pytest.raises(HTTPException) as rejected:
        await verify_gateway_request(signed_request, settings, NonceReplayCache())
    assert rejected.value.status_code == 401
