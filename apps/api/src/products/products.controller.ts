import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import type { Request } from "express";

import { RequireAuth } from "../auth/decorators/auth-realm.decorator";
import { RequireCsrf } from "../auth/decorators/csrf.decorator";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
// Nest requires DTO classes as runtime decorator metadata.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  CreateProductDto,
  ProductIdParamDto,
  ProductListQueryDto,
  ProductSlugParamDto,
  UpdateProductDto,
} from "./dto/product.dto";
import { ProductsService } from "./products.service";

@Controller("products")
export class PublicProductsController {
  constructor(
    @Inject(ProductsService) private readonly products: ProductsService,
  ) {}
  @Get() list(@Query() query: ProductListQueryDto) {
    return this.products.listPublic(query);
  }
  @Get(":slug") get(@Param() params: ProductSlugParamDto) {
    return this.products.getPublicBySlug(params.slug);
  }
}

@Controller("admin/products")
@RequireAuth("STAFF")
export class AdminProductsController {
  constructor(
    @Inject(ProductsService) private readonly products: ProductsService,
  ) {}
  @Get() @RequirePermissions("product.read") list(
    @Query() query: ProductListQueryDto,
  ) {
    return this.products.listAdmin(query);
  }
  @Post()
  @RequirePermissions("product.create")
  @RequireCsrf({ realm: "STAFF", binding: "SESSION" })
  create(@Body() input: CreateProductDto, @Req() request: Request) {
    return this.products.create(input, this.actor(request));
  }
  @Patch(":productId")
  @RequirePermissions("product.update")
  @RequireCsrf({ realm: "STAFF", binding: "SESSION" })
  update(
    @Param() params: ProductIdParamDto,
    @Body() input: UpdateProductDto,
    @Req() request: Request,
  ) {
    if (
      input.status === "ACTIVE" &&
      !request.principal?.permissions.includes("product.publish")
    ) {
      throw new ForbiddenException("Permission denied.");
    }
    return this.products.update(params.productId, input, this.actor(request));
  }
  @Delete(":productId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions("product.archive")
  @RequireCsrf({ realm: "STAFF", binding: "SESSION" })
  archive(@Param() params: ProductIdParamDto, @Req() request: Request) {
    return this.products.archive(params.productId, this.actor(request));
  }
  private actor(request: Request) {
    if (!request.principal) throw new Error("Authenticated principal missing.");
    return { userId: request.principal.userId, requestId: String(request.id) };
  }
}
