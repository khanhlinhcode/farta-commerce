from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.chat import Availability, ProductReference


class AvailabilityEvidence(BaseModel):
    observation_ref: str = Field(pattern=r"^availability-[1-9][0-9]*$", max_length=40)
    request_id: str = Field(min_length=8, max_length=128)
    tool: Literal["get_product_availability"] = "get_product_availability"
    product_slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=120)
    size: str | None = Field(default=None, max_length=40)
    color: str | None = Field(default=None, max_length=80)
    availability: Availability


class ToolCallRecord(BaseModel):
    tool: Literal[
        "search_products",
        "get_product_details",
        "get_product_availability",
    ]
    succeeded: bool
    product_slugs: list[str] = Field(default_factory=list, max_length=12)


class AgentState(BaseModel):
    request_id: str
    conversation_id: str
    current_request: str
    resolved_intent: str
    selected_product_slugs: list[str] = Field(default_factory=list, max_length=6)
    allowed_tools: tuple[str, ...] = (
        "search_products",
        "get_product_details",
        "get_product_availability",
    )
    tool_history: list[ToolCallRecord] = Field(default_factory=list, max_length=3)
    observations: list[ProductReference] = Field(default_factory=list, max_length=24)
    availability_evidence: list[AvailabilityEvidence] = Field(default_factory=list, max_length=12)
    step_count: int = Field(default=0, ge=0, le=3)
    stop_reason: str | None = None
    error_code: str | None = None
