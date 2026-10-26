from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


def to_camel(value: str) -> str:
    head, *tail = value.split("_")
    return head + "".join(part.capitalize() for part in tail)


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")


Availability = Literal["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"]
AvailabilityResolutionStatus = Literal["MATCHED", "NOT_FOUND", "AMBIGUOUS"]
KnowledgeSourceType = Literal[
    "PRODUCT",
    "CATEGORY",
    "SHIPPING_POLICY",
    "RETURN_POLICY",
    "SIZE_GUIDE",
    "FAQ",
]


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


class KnowledgeCitation(ApiModel):
    citation_id: str = Field(pattern=r"^citation:ragchunk_[a-f0-9]{64}$", max_length=100)
    source_type: KnowledgeSourceType
    source_id: str = Field(min_length=1, max_length=160)
    title: str = Field(min_length=1, max_length=200)
    canonical_path: str = Field(pattern=r"^/\S{1,499}$", max_length=500)
    chunk_id: str = Field(pattern=r"^ragchunk_[a-f0-9]{64}$", max_length=80)
    chunk_ordinal: int = Field(ge=0, le=10_000)
    excerpt: str = Field(min_length=1, max_length=4_000)
    source_version: str = Field(min_length=1, max_length=160)
    source_updated_at: str = Field(min_length=20, max_length=40)
    content_trust: Literal["UNTRUSTED_PUBLIC_CONTENT"]

    @field_validator("canonical_path")
    @classmethod
    def validate_canonical_path(cls, value: str) -> str:
        if value.startswith("//") or ".." in value:
            raise ValueError("Canonical citation path is invalid.")
        return value


class InternalChatResponse(ApiModel):
    request_id: str
    conversation_id: str
    status: Literal["completed", "clarification", "unavailable"]
    route: Literal["agent", "clarification", "unsupported"]
    message: str
    products: list[ProductReference] = Field(default_factory=list, max_length=12)
    citations: list[KnowledgeCitation] = Field(default_factory=list, max_length=8)
    error: ChatError | None = None


class AgentFinalResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(min_length=1, max_length=2_000)
    product_slugs: list[str] = Field(max_length=6)
    availability_claims: list["AgentAvailabilityClaim"] = Field(max_length=6)
    citation_ids: list[str] = Field(default_factory=list, max_length=8)
    requires_clarification: bool


class CatalogAgentFinalResponse(AgentFinalResponse):
    """Structured output for routes that cannot produce RAG citation evidence."""

    citation_ids: list[str] = Field(default_factory=list, max_length=0)


class AgentAvailabilityClaim(BaseModel):
    model_config = ConfigDict(extra="forbid")

    observation_ref: str = Field(pattern=r"^availability-[1-9][0-9]*$", max_length=40)
    product_slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=120)
    size: str | None = Field(max_length=40)
    color: str | None = Field(max_length=80)
    availability: Availability


class ToolAvailabilityResolution(ApiModel):
    status: AvailabilityResolutionStatus
    product_slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=120)
    size: str | None = Field(default=None, max_length=40)
    color: str | None = Field(default=None, max_length=80)
    availability: Availability | None = None


class ToolResponse(ApiModel):
    tool: Literal[
        "search_products",
        "get_product_details",
        "get_product_availability",
    ]
    products: list[ProductReference] = Field(default_factory=list, max_length=12)
    availability_resolution: ToolAvailabilityResolution | None = None


class KnowledgeToolResponse(ApiModel):
    tool: Literal["search_knowledge"]
    citations: list[KnowledgeCitation] = Field(default_factory=list, max_length=8)
