import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import type { Request } from "express";

import {
  OptionalAuth,
  RequireAuth,
} from "../auth/decorators/auth-realm.decorator";
import { RateLimit } from "../auth/decorators/rate-limit.decorator";
import { CartCredentialService } from "../cart/cart-credential.service";
import { normalizeVietnamesePhone } from "../checkout/checkout.utils";
import { ApiException } from "../common/api-exception";
// Nest requires DTO classes as runtime decorator metadata.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  GuestOrderLookupDto,
  OrderCodeParamDto,
  OrderListQueryDto,
} from "./dto/order.dto";
import { OrdersService } from "./orders.service";

@Controller("orders")
export class OrdersController {
  constructor(
    @Inject(OrdersService) private readonly orders: OrdersService,
    @Inject(CartCredentialService)
    private readonly cartCredentials: CartCredentialService,
  ) {}

  @Get()
  @RequireAuth("CUSTOMER")
  list(@Req() request: Request, @Query() query: OrderListQueryDto) {
    if (!request.principal) this.authenticationRequired();
    return this.orders.listForCustomer(request.principal.userId, query.limit);
  }

  @Get(":orderCode")
  @OptionalAuth("CUSTOMER")
  get(@Req() request: Request, @Param() params: OrderCodeParamDto) {
    if (request.principal) {
      return this.orders.getForCustomer(
        params.orderCode,
        request.principal.userId,
      );
    }
    const credential = this.cartCredentials.read(request);
    if (!credential) this.authenticationRequired();
    return this.orders.getForGuestCredential(
      params.orderCode,
      this.cartCredentials.digest(credential),
    );
  }

  @Post("lookup")
  @RateLimit("ORDER_LOOKUP")
  lookup(@Body() input: GuestOrderLookupDto) {
    return this.orders.lookupGuest(
      input.orderCode,
      normalizeVietnamesePhone(input.phone),
    );
  }

  private authenticationRequired(): never {
    throw new ApiException(
      HttpStatus.UNAUTHORIZED,
      "AUTHENTICATION_REQUIRED",
      "Authentication or guest order verification is required.",
    );
  }
}
