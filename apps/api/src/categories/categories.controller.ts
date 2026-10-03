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
  Query,
  Req,
} from "@nestjs/common";
import type { Request } from "express";

import { RequireAuth } from "../auth/decorators/auth-realm.decorator";
import { RequireCsrf } from "../auth/decorators/csrf.decorator";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { CategoriesService } from "./categories.service";
// Nest requires DTO classes as runtime decorator metadata.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  CategoryIdParamDto,
  CategoryListQueryDto,
  CategorySlugParamDto,
  CreateCategoryDto,
  UpdateCategoryDto,
} from "./dto/category.dto";

@Controller("categories")
export class PublicCategoriesController {
  constructor(
    @Inject(CategoriesService) private readonly categories: CategoriesService,
  ) {}

  @Get()
  list() {
    return this.categories.listPublic();
  }

  @Get(":slug")
  get(@Param() params: CategorySlugParamDto) {
    return this.categories.getPublicBySlug(params.slug);
  }
}

@Controller("admin/categories")
@RequireAuth("STAFF")
export class AdminCategoriesController {
  constructor(
    @Inject(CategoriesService) private readonly categories: CategoriesService,
  ) {}

  @Get()
  @RequirePermissions("category.read")
  list(@Query() query: CategoryListQueryDto) {
    return this.categories.listAdmin(query);
  }

  @Post()
  @RequirePermissions("category.create")
  @RequireCsrf({ realm: "STAFF", binding: "SESSION" })
  create(@Body() input: CreateCategoryDto, @Req() request: Request) {
    return this.categories.create(input, this.actor(request));
  }

  @Patch(":categoryId")
  @RequirePermissions("category.update")
  @RequireCsrf({ realm: "STAFF", binding: "SESSION" })
  update(
    @Param() params: CategoryIdParamDto,
    @Body() input: UpdateCategoryDto,
    @Req() request: Request,
  ) {
    return this.categories.update(
      params.categoryId,
      input,
      this.actor(request),
    );
  }

  @Delete(":categoryId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions("category.archive")
  @RequireCsrf({ realm: "STAFF", binding: "SESSION" })
  archive(@Param() params: CategoryIdParamDto, @Req() request: Request) {
    return this.categories.archive(params.categoryId, this.actor(request));
  }

  private actor(request: Request) {
    if (!request.principal) throw new Error("Authenticated principal missing.");
    return { userId: request.principal.userId, requestId: String(request.id) };
  }
}
