from dataclasses import dataclass, field

from pydantic_ai import RunContext

from app.agents.state import AgentState, ToolCallRecord
from app.schemas.chat import ProductReference
from app.tools.commerce_client import CommerceClient
from app.tools.schemas import ProductAvailabilityArgs, ProductDetailsArgs, SearchProductsArgs


@dataclass
class AgentDependencies:
    commerce: CommerceClient
    state: AgentState
    products_by_slug: dict[str, ProductReference] = field(default_factory=dict)

    def observe(self, tool: str, products: list[ProductReference]) -> str:
        for product in products:
            self.products_by_slug[product.slug] = product
        self.state.observations = list(self.products_by_slug.values())[:24]
        self.state.tool_history.append(
            ToolCallRecord(
                tool=tool,
                succeeded=True,
                product_slugs=[product.slug for product in products],
            )
        )
        self.state.step_count += 1
        return f"{tool} returned {len(products)} authoritative product record(s)."


async def search_products(
    context: RunContext[AgentDependencies], request: SearchProductsArgs
) -> str:
    """Search the authoritative public FARTA catalog with validated filters."""
    response = await context.deps.commerce.search_products(request)
    return context.deps.observe("search_products", response.products)


async def get_product_details(
    context: RunContext[AgentDependencies], request: ProductDetailsArgs
) -> str:
    """Get authoritative public details for one known FARTA product slug."""
    response = await context.deps.commerce.get_product_details(request)
    return context.deps.observe("get_product_details", response.products)


async def get_product_availability(
    context: RunContext[AgentDependencies], request: ProductAvailabilityArgs
) -> str:
    """Check semantic availability for a known public product or variant."""
    response = await context.deps.commerce.get_product_availability(request)
    return context.deps.observe("get_product_availability", response.products)


APPROVED_TOOLS = (search_products, get_product_details, get_product_availability)
