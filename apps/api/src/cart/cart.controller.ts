import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";

import { OptionalAuth } from "../auth/decorators/auth-realm.decorator";
import { RateLimit } from "../auth/decorators/rate-limit.decorator";
import { CartMutationGuard } from "./cart-mutation.guard";
import { CartService } from "./cart.service";
// Nest requires DTO classes as runtime decorator metadata.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  AddCartItemDto,
  CartItemParamDto,
  UpdateCartItemDto,
} from "./dto/cart.dto";

@Controller("cart")
@OptionalAuth("CUSTOMER")
export class CartController {
  constructor(@Inject(CartService) private readonly carts: CartService) {}

  @Get()
  get(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.carts.get(request, response);
  }

  @Post("items")
  @RateLimit("CART_MUTATION")
  @UseGuards(CartMutationGuard)
  add(
    @Body() input: AddCartItemDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.carts.add(request, response, input.variantId, input.quantity);
  }

  @Patch("items/:itemId")
  @RateLimit("CART_MUTATION")
  @UseGuards(CartMutationGuard)
  update(
    @Param() params: CartItemParamDto,
    @Body() input: UpdateCartItemDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.carts.update(request, response, params.itemId, input.quantity);
  }

  @Delete("items/:itemId")
  @RateLimit("CART_MUTATION")
  @UseGuards(CartMutationGuard)
  remove(
    @Param() params: CartItemParamDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.carts.remove(request, response, params.itemId);
  }

  @Delete()
  @RateLimit("CART_MUTATION")
  @UseGuards(CartMutationGuard)
  clear(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.carts.clear(request, response);
  }

  @Post("merge")
  @RateLimit("CART_MERGE")
  @UseGuards(CartMutationGuard)
  merge(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.carts.merge(request, response);
  }
}
