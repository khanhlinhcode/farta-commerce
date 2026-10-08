import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  RawBody,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";

import { OptionalAuth } from "../auth/decorators/auth-realm.decorator";
import { RateLimit } from "../auth/decorators/rate-limit.decorator";
import { CartCredentialService } from "../cart/cart-credential.service";
import { CartMutationGuard } from "../cart/cart-mutation.guard";
import { ApiException } from "../common/api-exception";
// Nest requires DTO classes as runtime decorator metadata.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PaymentOrderCodeParamDto, SePayWebhookDto } from "./dto/payment.dto";
import { PaymentsService, type PaymentOwner } from "./payments.service";
import { PaymentProvider } from "./providers/payment-provider";

@Controller("payments")
@OptionalAuth("CUSTOMER")
export class PaymentsController {
  constructor(
    @Inject(PaymentsService) private readonly payments: PaymentsService,
    @Inject(CartCredentialService)
    private readonly cartCredentials: CartCredentialService,
  ) {}

  @Post(":orderCode/initiate")
  @RateLimit("PAYMENT_INITIATE")
  @UseGuards(CartMutationGuard)
  initiate(@Param() params: PaymentOrderCodeParamDto, @Req() request: Request) {
    return this.payments.initiate(params.orderCode, this.owner(request));
  }

  @Get(":orderCode/status")
  @RateLimit("PAYMENT_STATUS")
  status(@Param() params: PaymentOrderCodeParamDto, @Req() request: Request) {
    return this.payments.status(params.orderCode, this.owner(request));
  }

  private owner(request: Request): PaymentOwner {
    if (request.principal) {
      return { type: "CUSTOMER", customerId: request.principal.userId };
    }
    const credential = this.cartCredentials.read(request);
    if (credential) {
      return {
        type: "GUEST",
        guestOwnerDigest: this.cartCredentials.digest(credential),
      };
    }
    throw new ApiException(
      HttpStatus.UNAUTHORIZED,
      "AUTHENTICATION_REQUIRED",
      "Authentication or the original guest credential is required.",
    );
  }
}

@Controller("webhooks/sepay")
export class SePayWebhookController {
  constructor(
    @Inject(PaymentProvider) private readonly provider: PaymentProvider,
    @Inject(PaymentsService) private readonly payments: PaymentsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  receive(
    @RawBody() rawBody: Buffer | undefined,
    @Headers("x-sepay-signature") signature: string | undefined,
    @Headers("x-sepay-timestamp") timestamp: string | undefined,
    @Body() payload: SePayWebhookDto,
    @Req() request: Request,
  ) {
    const event = this.provider.verifyWebhook(
      rawBody,
      signature,
      timestamp,
      payload,
    );
    return this.payments.processWebhook(event, String(request.id));
  }
}
