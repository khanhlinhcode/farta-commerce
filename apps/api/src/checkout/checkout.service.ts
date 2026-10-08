import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectConnection } from "@nestjs/mongoose";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import type { Connection } from "mongoose";

import { CartService } from "../cart/cart.service";
import { isDuplicateKey } from "../catalog/catalog.utils";
import { ApiException } from "../common/api-exception";
import type { Environment } from "../config/environment";
import {
  IdempotencyService,
  type IdempotencyIdentity,
} from "../idempotency/idempotency.service";
import { InventoryService } from "../inventory/inventory.service";
import {
  OrdersService,
  type OrderCreationItem,
} from "../orders/orders.service";
import { PaymentsService } from "../payments/payments.service";
import { ReservationsService } from "../reservations/reservations.service";
import type { SubmitCheckoutDto } from "./dto/checkout.dto";
import { normalizeVietnamesePhone } from "./checkout.utils";

type CartReadModel = Awaited<
  ReturnType<CartService["requireForCheckout"]>
>["readModel"];

@Injectable()
export class CheckoutService {
  private readonly reservationTtl: number;
  private readonly flatShippingFee: number;
  private readonly freeShippingThreshold: number | null;
  private readonly quoteSecret: string;

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @Inject(CartService) private readonly carts: CartService,
    @Inject(IdempotencyService)
    private readonly idempotency: IdempotencyService,
    @Inject(InventoryService) private readonly inventory: InventoryService,
    @Inject(ReservationsService)
    private readonly reservations: ReservationsService,
    @Inject(OrdersService) private readonly orders: OrdersService,
    @Inject(PaymentsService) private readonly payments: PaymentsService,
    @Inject(ConfigService) config: ConfigService<Environment, true>,
  ) {
    this.reservationTtl = config.get("CHECKOUT_RESERVATION_TTL_SECONDS", {
      infer: true,
    });
    this.flatShippingFee = config.get("SHIPPING_FLAT_FEE_VND", {
      infer: true,
    });
    this.freeShippingThreshold = config.get("FREE_SHIPPING_THRESHOLD_VND", {
      infer: true,
    });
    this.quoteSecret = config.get("ORDER_LOOKUP_SECRET", { infer: true });
  }

  async preview(request: Request, response: Response) {
    const context = await this.carts.requireForCheckout(request, response);
    return this.previewResponse(context.readModel);
  }

  async submit(
    request: Request,
    response: Response,
    input: SubmitCheckoutDto,
    idempotencyKey: string | undefined,
  ) {
    this.assertIdempotencyKey(idempotencyKey);
    const owner = this.carts.resolveOwner(request, response, false);
    const canonicalInput = {
      recipientName: input.recipientName,
      phone: normalizeVietnamesePhone(input.phone),
      addressLine: input.addressLine,
      provinceCity: input.provinceCity,
      district: input.district ?? null,
      ward: input.ward ?? null,
      shippingMethod: input.shippingMethod,
      paymentMethod: input.paymentMethod,
      notes: input.notes ?? null,
      quoteToken: input.quoteToken,
    };
    const identity: IdempotencyIdentity = {
      realm: owner.type,
      ownerKey:
        owner.type === "CUSTOMER" ? owner.customerId : owner.credentialDigest,
      operation: "CHECKOUT_SUBMIT",
      key: idempotencyKey,
      requestHash: this.idempotency.hashRequest(canonicalInput),
    };
    const existing = await this.idempotency.find(identity);
    if (existing) return this.resolveReplay(identity);

    const session = await this.connection.startSession();
    let orderId: string | undefined;
    try {
      await session.withTransaction(async () => {
        const claim = await this.idempotency.claim(identity, session);
        const checkout = await this.carts.loadForCheckout(owner, session);
        const preview = this.previewResponse(checkout.readModel);
        if (!this.safeEqual(preview.quoteToken, input.quoteToken)) {
          throw new ApiException(
            HttpStatus.CONFLICT,
            "CHECKOUT_QUOTE_CHANGED",
            "Cart price or availability changed. Review the checkout again.",
          );
        }
        this.assertCheckoutReady(checkout.readModel);
        if (!preview.supportedPaymentMethods.includes(input.paymentMethod)) {
          throw new ApiException(
            HttpStatus.CONFLICT,
            "PAYMENT_METHOD_UNAVAILABLE",
            "The selected payment method is not available.",
          );
        }
        const items = this.orderItems(checkout.readModel);
        const expiresAt = new Date(Date.now() + this.reservationTtl * 1000);
        const reservationItems = items.map((item) => ({
          variantId: item.variantId,
          quantity: item.quantity,
        }));
        const reservations = await this.reservations.createActive(
          {
            items: reservationItems,
            cartId: checkout.cart.id,
            customerId: owner.type === "CUSTOMER" ? owner.customerId : null,
            guestOwnerDigest:
              owner.type === "GUEST" ? owner.credentialDigest : null,
            expiresAt,
            idempotencyRecordId: claim.id,
          },
          session,
        );
        await this.inventory.reserveBatch(
          reservationItems,
          {
            requestId: String(request.id),
            actorId: owner.type === "CUSTOMER" ? owner.customerId : null,
            reason: "Checkout inventory reservation.",
            referenceType: "CHECKOUT",
            referenceId: claim.id,
            idempotencyPrefix: `checkout:${claim.id}:reserve`,
          },
          session,
        );
        const order = await this.orders.create(
          {
            customerId: owner.type === "CUSTOMER" ? owner.customerId : null,
            guestOwnerDigest:
              owner.type === "GUEST" ? owner.credentialDigest : null,
            cartId: checkout.cart.id,
            shipping: {
              recipientName: canonicalInput.recipientName,
              phone: canonicalInput.phone,
              addressLine: canonicalInput.addressLine,
              provinceCity: canonicalInput.provinceCity,
              district: canonicalInput.district,
              ward: canonicalInput.ward,
              method: canonicalInput.shippingMethod,
              notes: canonicalInput.notes,
            },
            items,
            itemsSubtotal: preview.itemsSubtotal,
            shippingFee: preview.shippingFee,
            total: preview.total,
            paymentMethod: canonicalInput.paymentMethod,
            idempotencyRecordId: claim.id,
            requestId: String(request.id),
          },
          session,
        );
        await this.payments.createForCheckout(
          order,
          canonicalInput.paymentMethod,
          preview.paymentAmounts[canonicalInput.paymentMethod] ?? preview.total,
          idempotencyKey,
          expiresAt,
          session,
        );
        if (canonicalInput.paymentMethod === "COD") {
          await this.reservations.confirm(
            reservations.map((reservation) => reservation._id),
            order.id,
            session,
          );
        } else {
          await this.reservations.attachToOrder(
            reservations.map((reservation) => reservation._id),
            order.id,
            session,
          );
        }
        await this.carts.convert(checkout.cart.id, order.id, session);
        await this.idempotency.complete(claim.id, "ORDER", order.id, session);
        orderId = order.id;
      });
    } catch (error) {
      if (isDuplicateKey(error)) return this.resolveReplay(identity);
      if (this.isWriteConflict(error)) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          "CHECKOUT_STOCK_CONFLICT",
          "One or more items were allocated to another checkout.",
        );
      }
      throw error;
    } finally {
      await session.endSession();
    }
    if (!orderId)
      throw new Error("Checkout transaction did not create an order.");
    const order = await this.orders.getById(orderId);
    if (!order) throw new Error("Committed order could not be loaded.");
    return this.orders.response(order);
  }

  private previewResponse(cart: CartReadModel) {
    const shippingFee =
      this.freeShippingThreshold !== null &&
      cart.subtotal >= this.freeShippingThreshold
        ? 0
        : this.flatShippingFee;
    const total = this.safeAdd(cart.subtotal, shippingFee);
    const supportedPaymentMethods = this.payments.supportedMethods(total);
    const paymentAmounts = this.payments.paymentAmounts(total);
    const quoteToken = this.quote({
      cartId: cart.id,
      version: cart.version,
      lines: cart.items.map((item) => ({
        variantId: item.variant.id,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      itemsSubtotal: cart.subtotal,
      shippingFee,
      total,
      supportedPaymentMethods,
      paymentAmounts,
      conflicts: cart.conflicts,
    });
    return {
      items: cart.items,
      conflicts: cart.conflicts,
      currency: "VND" as const,
      itemsSubtotal: cart.subtotal,
      shippingFee,
      total,
      supportedPaymentMethods,
      paymentAmounts,
      reservationTtlSeconds: this.reservationTtl,
      quoteToken,
    };
  }

  private orderItems(cart: CartReadModel): OrderCreationItem[] {
    return cart.items.map((item) => {
      if (!item.product) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          "CHECKOUT_PRODUCT_UNAVAILABLE",
          "One or more products are unavailable.",
        );
      }
      return {
        productId: item.product.id,
        variantId: item.variant.id,
        productName: item.product.name,
        sku: item.variant.sku,
        color: item.variant.color,
        size: item.variant.size,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        lineSubtotal: item.lineSubtotal,
        image: item.image
          ? {
              secureUrl: item.image.secureUrl,
              width: item.image.width,
              height: item.image.height,
              altText: item.image.altText,
            }
          : null,
      };
    });
  }

  private assertCheckoutReady(cart: CartReadModel): void {
    if (cart.conflicts.length > 0 || cart.items.length === 0) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        "CHECKOUT_CART_CONFLICT",
        "Resolve cart availability conflicts before checkout.",
      );
    }
  }

  private async resolveReplay(identity: IdempotencyIdentity) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const record = await this.idempotency.find(identity);
      if (record?.status === "COMPLETED" && record.resourceId) {
        const order = await this.orders.getById(record.resourceId.toString());
        if (order) return this.orders.response(order);
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new ApiException(
      HttpStatus.CONFLICT,
      "CHECKOUT_IN_PROGRESS",
      "Checkout is still processing. Retry with the same idempotency key.",
    );
  }

  private quote(value: unknown): string {
    return createHmac("sha256", this.quoteSecret)
      .update(this.idempotency.hashRequest(value))
      .digest("hex");
  }

  private safeEqual(left: string, right: string): boolean {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private safeAdd(left: number, right: number): number {
    const result = left + right;
    if (!Number.isSafeInteger(result)) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        "CHECKOUT_MONEY_OVERFLOW",
        "Checkout total cannot be calculated safely.",
      );
    }
    return result;
  }

  private assertIdempotencyKey(
    value: string | undefined,
  ): asserts value is string {
    if (!value || !/^[A-Za-z0-9_-]{16,120}$/.test(value)) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        "INVALID_IDEMPOTENCY_KEY",
        "A valid Idempotency-Key header is required.",
      );
    }
  }

  private isWriteConflict(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      (("code" in error && (error as { code?: unknown }).code === 112) ||
        ("errorLabels" in error &&
          Array.isArray((error as { errorLabels?: unknown }).errorLabels) &&
          (error as { errorLabels: unknown[] }).errorLabels.includes(
            "TransientTransactionError",
          )))
    );
  }
}
