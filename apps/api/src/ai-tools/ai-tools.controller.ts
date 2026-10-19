import { Body, Controller, Inject, Post, UseGuards } from "@nestjs/common";

import { AiToolAuthGuard } from "./ai-tool-auth.guard";
import { AiToolsService } from "./ai-tools.service";
// DTO classes are required as runtime decorator metadata by Nest.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  ProductAvailabilityToolDto,
  ProductDetailsToolDto,
  SearchProductsToolDto,
} from "./dto/ai-tool.dto";

@Controller("internal/ai/tools")
@UseGuards(AiToolAuthGuard)
export class AiToolsController {
  constructor(@Inject(AiToolsService) private readonly tools: AiToolsService) {}

  @Post("search-products")
  search(@Body() input: SearchProductsToolDto) {
    return this.tools.search(input);
  }

  @Post("product-details")
  details(@Body() input: ProductDetailsToolDto) {
    return this.tools.details(input.slug);
  }

  @Post("availability")
  availability(@Body() input: ProductAvailabilityToolDto) {
    return this.tools.availability(input);
  }
}
