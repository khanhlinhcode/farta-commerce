import {
  Body,
  Controller,
  Headers,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";

import { OptionalAuth } from "../auth/decorators/auth-realm.decorator";
import { RateLimit } from "../auth/decorators/rate-limit.decorator";
import { CartMutationGuard } from "../cart/cart-mutation.guard";
import { CheckoutService } from "./checkout.service";
// Nest requires DTO classes as runtime decorator metadata.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CheckoutPreviewDto, SubmitCheckoutDto } from "./dto/checkout.dto";

@Controller("checkout")
@OptionalAuth("CUSTOMER")
@RateLimit("CHECKOUT")
@UseGuards(CartMutationGuard)
export class CheckoutController {
  constructor(
    @Inject(CheckoutService) private readonly checkout: CheckoutService,
  ) {}

  @Post("preview")
  preview(
    @Body() _input: CheckoutPreviewDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.checkout.preview(request, response);
  }

  @Post()
  submit(
    @Body() input: SubmitCheckoutDto,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.checkout.submit(request, response, input, idempotencyKey);
  }
}
