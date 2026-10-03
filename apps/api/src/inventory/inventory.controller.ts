import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Patch,
  Req,
} from "@nestjs/common";
import type { Request } from "express";

import { RequireAuth } from "../auth/decorators/auth-realm.decorator";
import { RequireCsrf } from "../auth/decorators/csrf.decorator";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { ApiException } from "../common/api-exception";
import { HttpStatus } from "@nestjs/common";
// Nest requires DTO classes as runtime decorator metadata.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  AdjustInventoryDto,
  InventoryVariantParamDto,
} from "./dto/inventory.dto";
import { InventoryService } from "./inventory.service";

@Controller("admin/inventory")
@RequireAuth("STAFF")
export class InventoryController {
  constructor(
    @Inject(InventoryService) private readonly inventory: InventoryService,
  ) {}

  @Get(":variantId")
  @RequirePermissions("inventory.read")
  get(@Param() params: InventoryVariantParamDto) {
    return this.inventory.get(params.variantId);
  }

  @Patch(":variantId/adjustments")
  @RequirePermissions("inventory.adjust")
  @RequireCsrf({ realm: "STAFF", binding: "SESSION" })
  adjust(
    @Param() params: InventoryVariantParamDto,
    @Body() input: AdjustInventoryDto,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Req() request: Request,
  ) {
    const key = idempotencyKey?.trim();
    if (!key || key.length < 8 || key.length > 160) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        "IDEMPOTENCY_KEY_REQUIRED",
        "A valid Idempotency-Key header is required.",
      );
    }
    if (!request.principal) throw new Error("Authenticated principal missing.");
    return this.inventory.adjust(
      params.variantId,
      input.quantityDelta,
      input.reason,
      key,
      { userId: request.principal.userId, requestId: String(request.id) },
    );
  }
}
