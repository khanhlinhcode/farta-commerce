import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Req,
} from "@nestjs/common";
import type { Request } from "express";

import { RequireAuth } from "../auth/decorators/auth-realm.decorator";
import { RequireCsrf } from "../auth/decorators/csrf.decorator";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
// Nest requires this DTO class as runtime decorator metadata.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ProductIdParamDto } from "../products/dto/product.dto";
// Nest requires DTO classes as runtime decorator metadata.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  CreateVariantDto,
  ProductVariantParamDto,
  UpdateVariantDto,
} from "./dto/variant.dto";
import { VariantsService } from "./variants.service";

@Controller("admin/products/:productId/variants")
@RequireAuth("STAFF")
export class VariantsController {
  constructor(
    @Inject(VariantsService) private readonly variants: VariantsService,
  ) {}

  @Get()
  @RequirePermissions("product.read")
  list(@Param() params: ProductIdParamDto) {
    return this.variants.list(params.productId);
  }

  @Post()
  @RequirePermissions("product.create")
  @RequireCsrf({ realm: "STAFF", binding: "SESSION" })
  create(
    @Param() params: ProductIdParamDto,
    @Body() input: CreateVariantDto,
    @Req() request: Request,
  ) {
    return this.variants.create(params.productId, input, this.actor(request));
  }

  @Patch(":variantId")
  @RequirePermissions("product.update")
  @RequireCsrf({ realm: "STAFF", binding: "SESSION" })
  update(
    @Param() params: ProductVariantParamDto,
    @Body() input: UpdateVariantDto,
    @Req() request: Request,
  ) {
    return this.variants.update(
      params.productId,
      params.variantId,
      input,
      this.actor(request),
    );
  }

  @Delete(":variantId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions("product.archive")
  @RequireCsrf({ realm: "STAFF", binding: "SESSION" })
  archive(@Param() params: ProductVariantParamDto, @Req() request: Request) {
    return this.variants.archive(
      params.productId,
      params.variantId,
      this.actor(request),
    );
  }

  private actor(request: Request) {
    if (!request.principal) throw new Error("Authenticated principal missing.");
    return { userId: request.principal.userId, requestId: String(request.id) };
  }
}
