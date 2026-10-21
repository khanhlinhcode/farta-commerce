from app.routing.intent_router import IntentRouter
from app.tools.schemas import ProductAvailabilityArgs, SearchProductsArgs


def test_routes_supported_product_search_through_agent_with_bounded_hint() -> None:
    decision = IntentRouter().route("Tìm áo màu đen size M dưới 500k", [])
    assert decision.mode == "agent"
    assert decision.tool == "search_products"
    assert isinstance(decision.arguments, SearchProductsArgs)
    assert decision.arguments.color == "Đen"
    assert decision.arguments.size == "M"
    assert decision.arguments.max_price == 500_000
    assert decision.arguments.model_dump(by_alias=True)["maxPrice"] == 500_000


def test_availability_requires_an_authoritative_product_reference() -> None:
    missing = IntentRouter().route("Còn size M không?", [])
    assert missing.mode == "clarification"

    resolved = IntentRouter().route("Còn size M không?", ["farta-essential-tee"])
    assert resolved.mode == "agent"
    assert resolved.tool == "get_product_availability"
    assert isinstance(resolved.arguments, ProductAvailabilityArgs)
    assert resolved.arguments.slug == "farta-essential-tee"


def test_rejects_private_commerce_topics() -> None:
    decision = IntentRouter().route("Kiểm tra đơn hàng của tôi", [])
    assert decision.mode == "unsupported"


def test_routes_vietnamese_without_accents_and_selected_product_context() -> None:
    search = IntentRouter().route("Tim ao thun den size M duoi 600k", [])
    assert search.mode == "agent"
    assert search.tool == "search_products"
    assert isinstance(search.arguments, SearchProductsArgs)
    assert search.arguments.keyword == "áo thun"
    assert search.arguments.color == "Đen"
    assert search.arguments.max_price == 600_000

    accented = IntentRouter().route("Tìm áo màu đen size M", [])
    assert isinstance(accented.arguments, SearchProductsArgs)
    assert accented.arguments.keyword == "áo"

    details = IntentRouter().route("Cho toi chi tiet mau nay", ["farta-essential-tee"])
    assert details.mode == "agent"
    assert details.tool == "get_product_details"
