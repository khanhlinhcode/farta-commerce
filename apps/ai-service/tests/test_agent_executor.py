import pytest
from pydantic_ai.exceptions import ModelHTTPError
from pydantic_ai.models.function import FunctionModel
from pydantic_ai.models.test import TestModel
from pydantic_core import ValidationError

from app.agents.executor import AgentExecutor
from app.config import Settings
from app.schemas.chat import InternalChatRequest, ProductReference, ProductVariant, ToolResponse
from app.tools.registry import APPROVED_TOOLS
from app.tools.schemas import SearchProductsArgs

pytestmark = pytest.mark.anyio


PRODUCT = ProductReference(
    id="507f1f77bcf86cd799439011",
    slug="farta-essential-tee",
    name="FARTA Essential Tee",
    short_description="Áo thun cotton.",
    image_url="https://res.cloudinary.com/demo/image/upload/sample.jpg",
    price_vnd=399_000,
    max_price_vnd=399_000,
    availability="IN_STOCK",
    variants=[
        ProductVariant(
            id="507f1f77bcf86cd799439012",
            color="Đen",
            color_code="#171717",
            size="M",
            price_vnd=399_000,
            availability="IN_STOCK",
        )
    ],
)


class FakeCommerce:
    async def search_products(self, _arguments) -> ToolResponse:
        return ToolResponse(tool="search_products", products=[PRODUCT])

    async def get_product_details(self, _arguments) -> ToolResponse:
        return ToolResponse(tool="get_product_details", products=[PRODUCT])

    async def get_product_availability(self, _arguments) -> ToolResponse:
        return ToolResponse(tool="get_product_availability", products=[PRODUCT])


def request(message: str) -> InternalChatRequest:
    return InternalChatRequest(
        request_id="request-12345678",
        conversation_id="00000000-0000-4000-8000-000000000001",
        message=message,
    )


async def test_deterministic_route_works_without_provider() -> None:
    executor = AgentExecutor(Settings(), FakeCommerce(), models=[])
    result = await executor.execute(request("Tìm áo màu đen size M"))
    assert result.route == "deterministic"
    assert result.status == "completed"
    assert result.products[0].price_vnd == 399_000


async def test_complex_route_fails_closed_when_providers_are_disabled() -> None:
    executor = AgentExecutor(Settings(), FakeCommerce(), models=[])
    result = await executor.execute(request("Tư vấn một bộ trang phục cho buổi triển lãm"))
    assert result.route == "agent"
    assert result.status == "unavailable"
    assert result.error and result.error.code == "AI_PROVIDER_DISABLED"


async def test_pydantic_agent_execution_returns_typed_clarification() -> None:
    model = TestModel(
        call_tools=[],
        custom_output_args={
            "message": "Bạn thích phom ôm hay relaxed?",
            "product_slugs": [],
            "requires_clarification": True,
        },
    )
    executor = AgentExecutor(Settings(), FakeCommerce(), models=[model])
    result = await executor.execute(request("Tư vấn phong cách phù hợp với tôi"))
    assert result.route == "agent"
    assert result.status == "clarification"


async def test_agent_hydrates_only_observed_product_references() -> None:
    model = TestModel(
        call_tools=["search_products"],
        custom_output_args={
            "message": "Đây là mẫu phù hợp.",
            "product_slugs": [PRODUCT.slug],
            "requires_clarification": False,
        },
    )
    executor = AgentExecutor(Settings(), FakeCommerce(), models=[model])
    result = await executor.execute(request("Tư vấn một bộ trang phục cho triển lãm"))
    assert result.status == "completed"
    assert [product.slug for product in result.products] == [PRODUCT.slug]


async def test_agent_rejects_unobserved_product_reference() -> None:
    model = TestModel(
        call_tools=["search_products"],
        custom_output_args={
            "message": "Mẫu này phù hợp.",
            "product_slugs": ["invented-product"],
            "requires_clarification": False,
        },
    )
    result = await AgentExecutor(Settings(), FakeCommerce(), models=[model]).execute(
        request("Tư vấn một bộ trang phục cho triển lãm")
    )
    assert result.status == "unavailable"
    assert result.error and result.error.code == "AI_OUTPUT_UNVERIFIED"


async def test_tool_call_limit_stops_multi_tool_run() -> None:
    model = TestModel(call_tools=["search_products", "get_product_details"])
    settings = Settings(max_tool_executions=1)
    result = await AgentExecutor(settings, FakeCommerce(), models=[model]).execute(
        request("Tư vấn một bộ trang phục cho triển lãm")
    )
    assert result.status == "unavailable"
    assert result.error and result.error.code == "AI_PROVIDER_UNAVAILABLE"


async def test_one_provider_fallback_is_allowed() -> None:
    def fail(_messages, _info):
        raise ModelHTTPError(429, "failed-test-provider")

    first = FunctionModel(fail)
    second = TestModel(
        call_tools=[],
        custom_output_args={
            "message": "Bạn muốn ưu tiên màu nào?",
            "product_slugs": [],
            "requires_clarification": True,
        },
    )
    result = await AgentExecutor(Settings(), FakeCommerce(), models=[first, second]).execute(
        request("Tư vấn phong cách phù hợp với tôi")
    )
    assert result.status == "clarification"


def test_tool_registry_is_fixed_and_arguments_are_strict() -> None:
    assert {tool.__name__ for tool in APPROVED_TOOLS} == {
        "search_products",
        "get_product_details",
        "get_product_availability",
    }
    with pytest.raises(ValidationError):
        SearchProductsArgs.model_validate({"limit": 100, "$where": "unsafe"})
