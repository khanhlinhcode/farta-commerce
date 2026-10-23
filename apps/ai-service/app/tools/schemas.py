from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.chat import to_camel


class ToolArguments(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
    )


class SearchProductsArgs(ToolArguments):
    keyword: str | None = Field(default=None, max_length=100)
    category: str | None = Field(default=None, max_length=120)
    color: str | None = Field(default=None, max_length=80)
    size: str | None = Field(default=None, max_length=40)
    min_price: int | None = Field(default=None, ge=0)
    max_price: int | None = Field(default=None, ge=0)
    availability: Literal["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"] | None = None
    limit: int = Field(default=6, ge=1, le=12)

    @model_validator(mode="after")
    def validate_price_range(self) -> "SearchProductsArgs":
        if (
            self.min_price is not None
            and self.max_price is not None
            and self.min_price > self.max_price
        ):
            raise ValueError("Minimum price cannot exceed maximum price.")
        return self


class ProductDetailsArgs(ToolArguments):
    slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=120)


class ProductAvailabilityArgs(ProductDetailsArgs):
    color: str | None = Field(default=None, max_length=80)
    size: str | None = Field(default=None, max_length=40)
