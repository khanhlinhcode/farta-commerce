import httpx
import pytest

from app.main import app


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.mark.anyio
async def test_liveness() -> None:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health/live")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_only_health_and_internal_agent_routes_exist() -> None:
    paths = set(app.openapi()["paths"])
    assert paths == {"/health/live", "/health/ready", "/v1/chat"}
