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
import { BannersService } from "./banners.service";
// Nest requires DTO classes as runtime decorator metadata.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  BannerIdParamDto,
  BannerQueryDto,
  CreateBannerDto,
  UpdateBannerDto,
} from "./dto/banner.dto";

@Controller("banners")
export class PublicBannersController {
  constructor(
    @Inject(BannersService) private readonly banners: BannersService,
  ) {}
  @Get() list(@Query() query: BannerQueryDto) {
    return this.banners.listPublic(query.position);
  }
}

@Controller("admin/banners")
@RequireAuth("STAFF")
export class AdminBannersController {
  constructor(
    @Inject(BannersService) private readonly banners: BannersService,
  ) {}
  @Get() @RequirePermissions("banner.read") list() {
    return this.banners.listAdmin();
  }
  @Post()
  @RequirePermissions("banner.create")
  @RequireCsrf({ realm: "STAFF", binding: "SESSION" })
  create(@Body() input: CreateBannerDto, @Req() request: Request) {
    this.requirePublishPermission(input.status, request);
    return this.banners.create(input, this.actor(request));
  }
  @Patch(":bannerId")
  @RequirePermissions("banner.update")
  @RequireCsrf({ realm: "STAFF", binding: "SESSION" })
  update(
    @Param() params: BannerIdParamDto,
    @Body() input: UpdateBannerDto,
    @Req() request: Request,
  ) {
    this.requirePublishPermission(input.status, request);
    return this.banners.update(params.bannerId, input, this.actor(request));
  }
  @Delete(":bannerId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions("banner.archive")
  @RequireCsrf({ realm: "STAFF", binding: "SESSION" })
  archive(@Param() params: BannerIdParamDto, @Req() request: Request) {
    return this.banners.archive(params.bannerId, this.actor(request));
  }
  private requirePublishPermission(
    status: string | undefined,
    request: Request,
  ) {
    if (
      status === "ACTIVE" &&
      !request.principal?.permissions.includes("banner.publish")
    )
      throw new ForbiddenException("Permission denied.");
  }
  private actor(request: Request) {
    if (!request.principal) throw new Error("Authenticated principal missing.");
    return { userId: request.principal.userId, requestId: String(request.id) };
  }
}
