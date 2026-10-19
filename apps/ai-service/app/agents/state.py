from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.chat import ProductReference


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
    step_count: int = Field(default=0, ge=0, le=3)
    stop_reason: str | None = None
    error_code: str | None = None
