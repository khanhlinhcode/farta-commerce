import base64
import hashlib
import hmac
import json
import secrets
import time
from typing import Any, TypeVar

import httpx
from pydantic import BaseModel

from app.config import Settings
from app.schemas.chat import KnowledgeToolResponse, ToolResponse
from app.tools.schemas import (
    ProductAvailabilityArgs,
    ProductDetailsArgs,
    SearchKnowledgeArgs,
    SearchProductsArgs,
)

ResponseT = TypeVar("ResponseT", bound=BaseModel)


class CommerceToolError(RuntimeError):
    pass


class CommerceClient:
    _audience = "farta-ai-tools"

    def __init__(self, settings: Settings, transport: httpx.AsyncBaseTransport | None = None):
        self._base_url = str(settings.api_base_url).rstrip("/")
        self._secret = settings.tools_shared_secret.get_secret_value()
        self._timeout = settings.tool_timeout_seconds
        self._transport = transport

    async def search_products(self, arguments: SearchProductsArgs) -> ToolResponse:
        return await self._post(
            "/api/v1/internal/ai/tools/search-products", arguments, ToolResponse
        )

    async def get_product_details(self, arguments: ProductDetailsArgs) -> ToolResponse:
        return await self._post(
            "/api/v1/internal/ai/tools/product-details", arguments, ToolResponse
        )

    async def get_product_availability(self, arguments: ProductAvailabilityArgs) -> ToolResponse:
        return await self._post("/api/v1/internal/ai/tools/availability", arguments, ToolResponse)

    async def search_knowledge(self, arguments: SearchKnowledgeArgs) -> KnowledgeToolResponse:
        return await self._post(
            "/api/v1/internal/ai/tools/search-knowledge",
            arguments,
            KnowledgeToolResponse,
        )

    async def _post(
        self,
        path: str,
        arguments: Any,
        response_model: type[ResponseT],
    ) -> ResponseT:
        body = json.dumps(
            arguments.model_dump(mode="json", by_alias=True, exclude_none=True),
            ensure_ascii=False,
            separators=(",", ":"),
        ).encode()
        headers = self._signed_headers("POST", path, body)
        try:
            async with httpx.AsyncClient(
                base_url=self._base_url,
                timeout=self._timeout,
                transport=self._transport,
            ) as client:
                response = await client.post(path, content=body, headers=headers)
            response.raise_for_status()
            return response_model.model_validate(response.json())
        except (httpx.HTTPError, ValueError) as error:
            raise CommerceToolError("Commerce tool request failed safely.") from error

    def _signed_headers(self, method: str, path: str, body: bytes) -> dict[str, str]:
        timestamp = str(int(time.time()))
        nonce = secrets.token_urlsafe(32)
        payload = b".".join(
            (
                timestamp.encode(),
                nonce.encode(),
                self._audience.encode(),
                method.upper().encode(),
                path.encode(),
                body,
            )
        )
        signature = hmac.new(self._secret.encode(), payload, hashlib.sha256).digest()
        return {
            "content-type": "application/json",
            "x-farta-ai-timestamp": timestamp,
            "x-farta-ai-nonce": nonce,
            "x-farta-ai-audience": self._audience,
            "x-farta-ai-signature": base64.urlsafe_b64encode(signature).rstrip(b"=").decode(),
        }
