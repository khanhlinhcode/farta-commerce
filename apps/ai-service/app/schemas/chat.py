from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


def to_camel(value: str) -> str:
    head, *tail = value.split("_")
    return head + "".join(part.capitalize() for part in tail)


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")


Availability = Literal["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"]


class ProductVariant(ApiModel):
    id: str
    color: str
    color_code: str | None = None
    size: str
    price_vnd: int = Field(ge=0)
    compare_at_price_vnd: int | None = Field(default=None, ge=0)
    availability: Availability


class ProductReference(ApiModel):
    id: str
    slug: str
    name: str
    short_description: str | None = None
    image_url: str | None = None
    price_vnd: int = Field(ge=0)
    max_price_vnd: int = Field(ge=0)
    availability: Availability
    variants: list[ProductVariant] = Field(default_factory=list, max_length=60)


class ConversationTurn(ApiModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=1_500)


class InternalChatRequest(ApiModel):
    request_id: str = Field(min_length=8, max_length=128)
    conversation_id: str = Field(min_length=16, max_length=128)
    message: str = Field(min_length=1, max_length=1_000)
    history: list[ConversationTurn] = Field(default_factory=list, max_length=6)
    selected_product_slugs: list[str] = Field(default_factory=list, max_length=6)


class ChatError(ApiModel):
    code: str
    message: str


class InternalChatResponse(ApiModel):
    request_id: str
    conversation_id: str
    status: Literal["completed", "clarification", "unavailable"]
    route: Literal["agent", "clarification", "unsupported"]
    message: str
    products: list[ProductReference] = Field(default_factory=list, max_length=12)
    citations: list[None] = Field(default_factory=list, max_length=0)
    error: ChatError | None = None


class AgentFinalResponse(BaseModel):
    message: str = Field(min_length=1, max_length=2_000)
    product_slugs: list[str] = Field(default_factory=list, max_length=6)
    requires_clarification: bool = False


class ToolResponse(ApiModel):
    tool: Literal[
        "search_products",
        "get_product_details",
        "get_product_availability",
    ]
    products: list[ProductReference] = Field(default_factory=list, max_length=12)
