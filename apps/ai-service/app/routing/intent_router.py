import re
import unicodedata
from dataclasses import dataclass
from typing import Literal

from app.tools.schemas import ProductAvailabilityArgs, ProductDetailsArgs, SearchProductsArgs

Intent = Literal[
    "PUBLIC_PRODUCT_SEARCH",
    "PUBLIC_PRODUCT_DETAILS",
    "PUBLIC_AVAILABILITY",
    "COMPLEX_SHOPPING_ADVICE",
    "CLARIFICATION_REQUIRED",
    "UNSUPPORTED",
]


@dataclass(frozen=True)
class RouteDecision:
    intent: Intent
    mode: Literal["deterministic", "agent", "clarification", "unsupported"]
    tool: str | None = None
    arguments: SearchProductsArgs | ProductDetailsArgs | ProductAvailabilityArgs | None = None


class IntentRouter:
    _product_url = re.compile(r"/product/([a-z0-9]+(?:-[a-z0-9]+)*)")
    _size = re.compile(r"\b(?:size|cỡ)\s*([a-z0-9]{1,4})\b", re.IGNORECASE)
    _price = re.compile(r"(?:dưới|tối đa|không quá)\s*([0-9]+(?:[.,][0-9]+)?)\s*(k|tr|triệu)?")
    _colors = ("đen", "kem", "trắng", "nâu", "xanh", "đỏ", "hồng", "be")
    _unsafe_topics = (
        "đơn hàng",
        "hoàn tiền",
        "thanh toán",
        "hủy đơn",
        "địa chỉ",
        "số điện thoại",
        "email",
    )

    def route(self, message: str, selected_slugs: list[str]) -> RouteDecision:
        normalized = self._normalize(message)
        if any(topic in normalized for topic in self._unsafe_topics):
            return RouteDecision("UNSUPPORTED", "unsupported")

        slug_match = self._product_url.search(normalized)
        slug = (
            slug_match.group(1) if slug_match else (selected_slugs[-1] if selected_slugs else None)
        )
        if any(term in normalized for term in ("còn hàng", "còn size", "hết hàng")):
            if not slug:
                return RouteDecision("CLARIFICATION_REQUIRED", "clarification")
            return RouteDecision(
                "PUBLIC_AVAILABILITY",
                "deterministic",
                "get_product_availability",
                ProductAvailabilityArgs(
                    slug=slug,
                    color=self._color(normalized),
                    size=self._size_value(normalized),
                ),
            )
        if slug_match and any(term in normalized for term in ("chi tiết", "sản phẩm", "mẫu này")):
            return RouteDecision(
                "PUBLIC_PRODUCT_DETAILS",
                "deterministic",
                "get_product_details",
                ProductDetailsArgs(slug=slug_match.group(1)),
            )
        if any(term in normalized for term in ("tìm", "cho xem", "mẫu", "sản phẩm", "váy", "áo")):
            return RouteDecision(
                "PUBLIC_PRODUCT_SEARCH",
                "deterministic",
                "search_products",
                SearchProductsArgs(
                    keyword=self._keyword(normalized),
                    color=self._color(normalized),
                    size=self._size_value(normalized),
                    max_price=self._max_price(normalized),
                    limit=6,
                ),
            )
        if len(normalized.split()) < 3:
            return RouteDecision("CLARIFICATION_REQUIRED", "clarification")
        return RouteDecision("COMPLEX_SHOPPING_ADVICE", "agent")

    @staticmethod
    def _normalize(value: str) -> str:
        return unicodedata.normalize("NFKC", value).strip().lower()

    def _color(self, value: str) -> str | None:
        return next((color.capitalize() for color in self._colors if color in value), None)

    def _size_value(self, value: str) -> str | None:
        match = self._size.search(value)
        return match.group(1).upper() if match else None

    def _max_price(self, value: str) -> int | None:
        match = self._price.search(value)
        if not match:
            return None
        amount = float(match.group(1).replace(",", "."))
        suffix = match.group(2)
        multiplier = 1_000_000 if suffix in {"tr", "triệu"} else 1_000 if suffix == "k" else 1
        return int(amount * multiplier)

    def _keyword(self, value: str) -> str | None:
        cleaned = self._price.sub("", value)
        cleaned = self._size.sub("", cleaned)
        cleaned = cleaned.replace("váy", "đầm")
        for token in (
            *self._colors,
            "tìm",
            "cho xem",
            "giúp tôi",
            "sản phẩm",
            "mẫu",
            "màu",
        ):
            cleaned = cleaned.replace(token, " ")
        cleaned = " ".join(cleaned.split()).strip(" ,.?")
        return cleaned[:100] or None
