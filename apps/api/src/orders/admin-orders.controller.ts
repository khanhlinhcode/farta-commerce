import {
  Body,
  Controller,
  Get,
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
import { PaymentsService } from "../payments/payments.service";
// Nest requires DTO classes as runtime decorator metadata.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  AdminOrderCodeParamDto,
  AdminOrderListQueryDto,
  CancelOrderDto,
  ReconcilePaymentDto,
  TransitionOrderDto,
} from "./dto/admin-order.dto";
import { OrdersService } from "./orders.service";

@Controller("admin/orders")
@RequireAuth("STAFF")
export class AdminOrdersController {
  constructor(
    @Inject(OrdersService) private readonly orders: OrdersService,
    @Inject(PaymentsService) private readonly payments: PaymentsService,
  ) {}

  @Get()
  @RequirePermissions("order.read")
  list(@Query() query: AdminOrderListQueryDto) {
    return this.orders.listAdmin(query);
  }

  @Get(":orderCode")
  @RequirePermissions("order.read")
  get(@Param() params: AdminOrderCodeParamDto) {
    return this.orders.getAdmin(params.orderCode);
  }

  @Patch(":orderCode/status")
  @RequirePermissions("order.update")
  @RequireCsrf({ realm: "STAFF", binding: "SESSION" })
  transition(
    @Param() params: AdminOrderCodeParamDto,
    @Body() input: TransitionOrderDto,
    @Req() request: Request,
  ) {
    return this.orders.transition(
      params.orderCode,
      input.status,
      input.reason,
      this.actor(request),
    );
  }

  @Post(":orderCode/cancel")
  @RequirePermissions("order.cancel")
  @RequireCsrf({ realm: "STAFF", binding: "SESSION" })
  cancel(
    @Param() params: AdminOrderCodeParamDto,
    @Body() input: CancelOrderDto,
    @Req() request: Request,
  ) {
    return this.orders.cancel(
      params.orderCode,
      input.reason,
      this.actor(request),
    );
  }

  @Post(":orderCode/payment-reconciliation")
  @RequirePermissions("order.update")
  @RequireCsrf({ realm: "STAFF", binding: "SESSION" })
  reconcile(
    @Param() params: AdminOrderCodeParamDto,
    @Body() input: ReconcilePaymentDto,
    @Req() request: Request,
  ) {
    return this.payments.reconcile(
      params.orderCode,
      input.action,
      input.reason,
      input.externalReference ?? null,
      this.actor(request),
    );
  }

  @Post(":orderCode/cod-collected")
  @RequirePermissions("order.update")
  @RequireCsrf({ realm: "STAFF", binding: "SESSION" })
  collectCod(
    @Param() params: AdminOrderCodeParamDto,
    @Body() input: CancelOrderDto,
    @Req() request: Request,
  ) {
    return this.payments.recordCodCollected(
      params.orderCode,
      input.reason,
      this.actor(request),
    );
  }

  private actor(request: Request) {
    if (!request.principal) throw new Error("Authenticated principal missing.");
    return { userId: request.principal.userId, requestId: String(request.id) };
  }
}
