import json

import httpx
import pytest

from app.config import Settings
from app.tools.commerce_client import CommerceClient
from app.tools.schemas import SearchKnowledgeArgs


@pytest.mark.anyio
async def test_search_knowledge_uses_the_signed_read_only_gateway_once() -> None:
    requests: list[httpx.Request] = []
    citation_id = f"citation:ragchunk_{'a' * 64}"

    async def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(
            200,
            json={
                "tool": "search_knowledge",
                "citations": [
                    {
                        "citationId": citation_id,
                        "sourceType": "SHIPPING_POLICY",
                        "sourceId": "shipping-standard",
                        "title": "Chính sách giao hàng",
                        "canonicalPath": "/policies/shipping",
                        "chunkId": f"ragchunk_{'a' * 64}",
                        "chunkOrdinal": 0,
                        "excerpt": "Nội dung chính sách công khai.",
                        "sourceVersion": "shipping-v1",
                        "sourceUpdatedAt": "2026-10-25T00:00:00.000Z",
                        "contentTrust": "UNTRUSTED_PUBLIC_CONTENT",
                    }
                ],
            },
        )

    client = CommerceClient(
        Settings(tools_shared_secret="t" * 32),
        transport=httpx.MockTransport(handler),
    )
    result = await client.search_knowledge(
        SearchKnowledgeArgs(
            query="chính sách giao hàng",
            source_types=["SHIPPING_POLICY"],
            limit=1,
        )
    )

    assert len(requests) == 1
    sent = requests[0]
    assert sent.method == "POST"
    assert sent.url.path == "/api/v1/internal/ai/tools/search-knowledge"
    assert sent.headers["x-farta-ai-audience"] == "farta-ai-tools"
    assert "x-farta-ai-signature" in sent.headers
    assert json.loads(sent.content) == {
        "query": "chính sách giao hàng",
        "locale": "vi",
        "sourceTypes": ["SHIPPING_POLICY"],
        "limit": 1,
    }
    assert [citation.citation_id for citation in result.citations] == [citation_id]
