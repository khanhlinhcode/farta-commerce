import re
import unicodedata
from dataclasses import dataclass
from typing import Literal

from app.catalog_normalization import normalize_catalog_text
from app.tools.schemas import (
    ProductAvailabilityArgs,
    ProductDetailsArgs,
    SearchKnowledgeArgs,
    SearchProductsArgs,
)

Intent = Literal[
    "PUBLIC_PRODUCT_SEARCH",
    "PUBLIC_PRODUCT_DETAILS",
    "PUBLIC_AVAILABILITY",
    "PUBLIC_KNOWLEDGE",
    "COMPLEX_SHOPPING_ADVICE",
    "CLARIFICATION_REQUIRED",
    "UNSUPPORTED",
]


@dataclass(frozen=True)
class RouteDecision:
    intent: Intent
    mode: Literal["agent", "clarification", "unsupported"]
    tool: str | None = None
    arguments: (
        SearchProductsArgs
        | ProductDetailsArgs
        | ProductAvailabilityArgs
        | SearchKnowledgeArgs
        | None
    ) = None


class IntentRouter:
    _product_url = re.compile(r"/product/([a-z0-9]+(?:-[a-z0-9]+)*)")
    _size = re.compile(r"\b(?:size|co)\s+([a-z0-9]{1,4})\b", re.IGNORECASE)
    _price = re.compile(r"(?:duoi|toi da|khong qua)\s*([0-9]+(?:[.,][0-9]+)?)\s*(k|tr|trieu)?")
    _colors = {
        "den": "Đen",
        "kem": "Kem",
        "trang": "Trắng",
        "nau": "Nâu",
        "xanh": "Xanh",
        "do": "Đỏ",
        "hong": "Hồng",
        "be": "Be",
    }
    _unsafe_topics = (
        "don hang",
        "hoan tien",
        "refund",
        "thanh toan",
        "huy don",
        "dia chi",
        "so dien thoai",
        "email",
        "dieu chinh ton kho",
        "tang ton kho",
        "giam ton kho",
        "doi gia",
        "thay gia",
        "doi quyen",
        "phan quyen",
        "vai tro admin",
        "system prompt",
        "ignore previous",
        "bo qua chi dan",
        "bo qua ket qua tool",
        "tao san pham gia",
        "bia san pham",
        "gia mao san pham",
        "api key",
        "mat khau",
        "so luong chinh xac trong kho",
    )
    _advice_terms = (
        "tu van",
        "phoi do",
        "phoi mau",
        "phoi voi",
        "so sanh",
        "chon giua",
        "mac di",
        "trang phuc cho",
        "hop voi",
    )
    _knowledge_terms = {
        "PRODUCT": (
            "chat lieu",
            "thanh phan vai",
            "loai vai",
            "vai gi",
            "mo ta san pham",
            "dac diem san pham",
            "fabric",
            "material",
            "product description",
        ),
        "SHIPPING_POLICY": (
            "giao hang",
            "van chuyen",
            "phi ship",
            "thoi gian ship",
            "shipping policy",
            "shipping fee",
            "delivery time",
        ),
        "RETURN_POLICY": (
            "doi tra",
            "tra hang",
            "chinh sach doi",
            "return policy",
            "returns policy",
        ),
        "SIZE_GUIDE": (
            "bang size",
            "huong dan size",
            "kich thuoc",
            "chon size",
            "size guide",
            "size chart",
        ),
        "FAQ": ("cau hoi thuong gap", "faq", "frequently asked questions"),
    }
    _product_context_terms = (
        "mau nay",
        "san pham nay",
        "ao nay",
        "dam nay",
        "vay nay",
        "quan nay",
        "this product",
        "this item",
    )
    _product_query_noise = {
        "a",
        "about",
        "an",
        "ao",
        "are",
        "biet",
        "cai",
        "chiec",
        "cho",
        "co",
        "dam",
        "does",
        "duoc",
        "dung",
        "from",
        "gi",
        "hay",
        "is",
        "it",
        "item",
        "khong",
        "la",
        "lam",
        "made",
        "mau",
        "me",
        "nay",
        "of",
        "pham",
        "please",
        "product",
        "quan",
        "san",
        "ta",
        "tell",
        "the",
        "this",
        "toi",
        "tu",
        "use",
        "using",
        "vay",
        "what",
        "which",
    }

    def __init__(self, *, rag_enabled: bool = False) -> None:
        self._rag_enabled = rag_enabled

    def route(self, message: str, selected_slugs: list[str]) -> RouteDecision:
        normalized = self._normalize(message)
        matchable = self._fold(normalized)
        if any(topic in matchable for topic in self._unsafe_topics):
            return RouteDecision("UNSUPPORTED", "unsupported")

        slug_match = self._product_url.search(matchable)
        slug = (
            slug_match.group(1) if slug_match else (selected_slugs[-1] if selected_slugs else None)
        )
        knowledge_sources = [
            source_type
            for source_type, terms in self._knowledge_terms.items()
            if any(term in matchable for term in terms)
        ]
        if knowledge_sources:
            if not self._rag_enabled:
                return RouteDecision("UNSUPPORTED", "unsupported")
            knowledge_query = message
            if knowledge_sources == ["PRODUCT"]:
                shaped_query = self._product_knowledge_query(matchable, slug)
                if shaped_query is None:
                    return RouteDecision("CLARIFICATION_REQUIRED", "clarification")
                knowledge_query = shaped_query
            return RouteDecision(
                "PUBLIC_KNOWLEDGE",
                "agent",
                "search_knowledge",
                SearchKnowledgeArgs(
                    query=knowledge_query,
                    source_types=knowledge_sources,
                    limit=5,
                ),
            )

        if any(
            term in matchable for term in ("con hang", "con size", "con co", "con szie", "het hang")
        ):
            if not slug:
                return RouteDecision("CLARIFICATION_REQUIRED", "clarification")
            return RouteDecision(
                "PUBLIC_AVAILABILITY",
                "agent",
                "get_product_availability",
                ProductAvailabilityArgs(
                    slug=slug,
                    color=self._color(matchable),
                    size=self._size_value(matchable),
                ),
            )
        if any(term in matchable for term in self._advice_terms):
            return RouteDecision("COMPLEX_SHOPPING_ADVICE", "agent")
        if slug and any(term in matchable for term in ("chi tiet", "san pham", "mau nay")):
            return RouteDecision(
                "PUBLIC_PRODUCT_DETAILS",
                "agent",
                "get_product_details",
                ProductDetailsArgs(slug=slug),
            )
        if "cho xem" in matchable or re.search(r"\b(?:tim|mau|san pham|vay|ao)\b", matchable):
            return RouteDecision(
                "PUBLIC_PRODUCT_SEARCH",
                "agent",
                "search_products",
                SearchProductsArgs(
                    keyword=self._keyword(matchable),
                    color=self._color(matchable),
                    size=self._size_value(matchable),
                    max_price=self._max_price(matchable),
                    limit=6,
                ),
            )
        if len(normalized.split()) < 3:
            return RouteDecision("CLARIFICATION_REQUIRED", "clarification")
        return RouteDecision("COMPLEX_SHOPPING_ADVICE", "agent")

    @staticmethod
    def _normalize(value: str) -> str:
        return normalize_catalog_text(value)

    @staticmethod
    def _fold(value: str) -> str:
        decomposed = unicodedata.normalize("NFKD", value)
        without_marks = "".join(
            character for character in decomposed if not unicodedata.combining(character)
        )
        return without_marks.replace("đ", "d")

    def _color(self, value: str) -> str | None:
        return next(
            (
                label
                for color, label in self._colors.items()
                if re.search(rf"(?<!\w){re.escape(color)}(?!\w)", value)
            ),
            None,
        )

    def _size_value(self, value: str) -> str | None:
        match = self._size.search(value)
        return match.group(1).upper() if match else None

    def _max_price(self, value: str) -> int | None:
        match = self._price.search(value)
        if not match:
            return None
        amount = float(match.group(1).replace(",", "."))
        suffix = match.group(2)
        multiplier = 1_000_000 if suffix in {"tr", "trieu"} else 1_000 if suffix == "k" else 1
        return int(amount * multiplier)

    def _product_knowledge_query(self, value: str, slug: str | None) -> str | None:
        cleaned = value
        for term in sorted(self._knowledge_terms["PRODUCT"], key=len, reverse=True):
            cleaned = re.sub(rf"(?<!\w){re.escape(term)}(?!\w)", " ", cleaned)
        tokens = [
            token
            for token in re.findall(r"[^\W_]+", cleaned, flags=re.UNICODE)
            if token not in self._product_query_noise
        ]
        refers_to_selected_product = any(term in value for term in self._product_context_terms)
        if slug and (refers_to_selected_product or not tokens):
            slug_tokens = slug.split("-")
            if slug_tokens and slug_tokens[0] in {"dev", "staging"}:
                slug_tokens = slug_tokens[1:]
            tokens = [*slug_tokens, *tokens]
        unique_tokens = list(dict.fromkeys(tokens))
        query = " ".join(unique_tokens)[:300]
        return query if len(query) >= 2 else None

    def _keyword(self, value: str) -> str | None:
        cleaned = self._price.sub("", value)
        cleaned = self._size.sub("", cleaned)
        cleaned = re.sub(r"\bao thun\b", "áo thun", cleaned)
        cleaned = re.sub(r"\bao\b", "áo", cleaned)
        cleaned = re.sub(r"\bvay\b", "đầm", cleaned)
        cleaned = re.sub(r"\bquan\b", "quần", cleaned)
        for token in (
            *self._colors.keys(),
            "tim",
            "cho xem",
            "giup toi",
            "san pham",
            "mau",
        ):
            cleaned = cleaned.replace(token, " ")
        cleaned = " ".join(cleaned.split()).strip(" ,.?")
        return cleaned[:100] or None
