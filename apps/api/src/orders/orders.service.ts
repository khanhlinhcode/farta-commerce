import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { createHmac, randomBytes } from "node:crypto";
import type { ClientSession, Model } from "mongoose";

import { objectId } from "../catalog/catalog.utils";
import { ApiException } from "../common/api-exception";
import type { Environment } from "../config/environment";
import {
  Payment,
  type PaymentDocument,
} from "../payments/schemas/payment.schema";
import { Order, type OrderDocument } from "./schemas/order.schema";

export type OrderCreationItem = {
  productId: string;
  variantId: string;
  productName: string;
  sku: string;
  color: string;
  size: string;
  unitPrice: number;
  quantity: number;
  lineSubtotal: number;
  image: {
    secureUrl: string;
    width: number;
    height: number;
    altText: string | null;
  } | null;
};

export type OrderShippingInput = {
  recipientName: string;
  phone: string;
  addressLine: string;
  provinceCity: string;
  district: string | null;
  ward: string | null;
  method: "STANDARD";
  notes: string | null;
};

@Injectable()
export class OrdersService {
  private readonly lookupSecret: string;

  constructor(
    @InjectModel(Order.name) private readonly orders: Model<OrderDocument>,
    @InjectModel(Payment.name)
    private readonly payments: Model<PaymentDocument>,
    @Inject(ConfigService) config: ConfigService<Environment, true>,
  ) {
    this.lookupSecret = config.get("ORDER_LOOKUP_SECRET", { infer: true });
  }

  async create(
    input: {
      customerId: string | null;
      guestOwnerDigest: string | null;
      cartId: string;
      shipping: OrderShippingInput;
      items: ReadonlyArray<OrderCreationItem>;
      itemsSubtotal: number;
      shippingFee: number;
      total: number;
      idempotencyRecordId: string;
      requestId: string;
    },
    session: ClientSession,
  ): Promise<OrderDocument> {
    const [order] = await this.orders.create(
      [
        {
          orderCode: this.orderCode(),
          customerId: input.customerId ? objectId(input.customerId) : null,
          guestOwnerDigest: input.guestOwnerDigest,
          lookupPhoneDigest: this.phoneDigest(input.shipping.phone),
          cartId: objectId(input.cartId),
          status: "CREATED",
          paymentStatus: "UNPAID",
          paymentMethod: "COD",
          items: input.items.map((item) => ({
            ...item,
            productId: objectId(item.productId),
            variantId: objectId(item.variantId),
          })),
          shipping: input.shipping,
          itemsSubtotal: input.itemsSubtotal,
          shippingFee: input.shippingFee,
          total: input.total,
          currency: "VND",
          statusHistory: [
            {
              status: "CREATED",
              at: new Date(),
              actorType: input.customerId ? "CUSTOMER" : "GUEST",
              actorId: input.customerId ? objectId(input.customerId) : null,
              requestId: input.requestId,
            },
          ],
          idempotencyRecordId: objectId(input.idempotencyRecordId),
        },
      ],
      { session },
    );
    if (!order) throw new Error("Order was not created.");
    return order;
  }

  async getById(id: string): Promise<OrderDocument | null> {
    return this.orders.findById(id).exec();
  }

  async listForCustomer(customerId: string, limit: number) {
    const orders = await this.orders
      .find({ customerId: objectId(customerId) })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .exec();
    return {
      items: orders.map((order) => ({
        id: order.id,
        orderCode: order.orderCode,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        currency: order.currency,
        itemCount: order.items.reduce(
          (total, item) => total + item.quantity,
          0,
        ),
        total: order.total,
        createdAt: order.createdAt.toISOString(),
      })),
    };
  }

  async getForCustomer(orderCode: string, customerId: string) {
    const order = await this.orders.findOne({
      orderCode,
      customerId: objectId(customerId),
    });
    if (!order) this.notFound();
    return this.response(order);
  }

  async getForGuestCredential(orderCode: string, guestDigest: string) {
    const order = await this.orders
      .findOne({ orderCode, guestOwnerDigest: guestDigest })
      .select("+guestOwnerDigest");
    if (!order) this.notFound();
    return this.response(order);
  }

  async lookupGuest(orderCode: string, canonicalPhone: string) {
    const order = await this.orders
      .findOne({
        orderCode,
        customerId: null,
        lookupPhoneDigest: this.phoneDigest(canonicalPhone),
      })
      .select("+lookupPhoneDigest");
    if (!order) this.notFound();
    return this.serializeGuestLookup(order);
  }

  async response(order: OrderDocument) {
    const payment = await this.payments.findOne({ orderId: order._id });
    return this.serialize(order, payment);
  }

  private serialize(order: OrderDocument, payment: PaymentDocument | null) {
    return {
      id: order.id,
      orderCode: order.orderCode,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      currency: order.currency,
      items: order.items.map((item) => ({
        productId: item.productId.toString(),
        variantId: item.variantId.toString(),
        productName: item.productName,
        sku: item.sku,
        color: item.color,
        size: item.size,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        lineSubtotal: item.lineSubtotal,
        image: item.image,
      })),
      shipping: order.shipping,
      itemsSubtotal: order.itemsSubtotal,
      shippingFee: order.shippingFee,
      total: order.total,
      timeline: order.statusHistory.map((entry) => ({
        status: entry.status,
        at: entry.at.toISOString(),
      })),
      payment: payment
        ? {
            provider: payment.provider,
            method: payment.method,
            status: payment.status,
            amount: payment.expectedAmount,
            currency: payment.currency,
            codAmount: payment.codAmount,
            codCollectedAt: payment.codCollectedAt?.toISOString() ?? null,
          }
        : null,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    };
  }

  private serializeGuestLookup(order: OrderDocument) {
    return {
      orderCode: order.orderCode,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      currency: order.currency,
      items: order.items.map((item) => ({
        productName: item.productName,
        color: item.color,
        size: item.size,
        quantity: item.quantity,
        lineSubtotal: item.lineSubtotal,
        image: item.image,
      })),
      itemsSubtotal: order.itemsSubtotal,
      shippingFee: order.shippingFee,
      total: order.total,
      timeline: order.statusHistory.map((entry) => ({
        status: entry.status,
        at: entry.at.toISOString(),
      })),
      createdAt: order.createdAt.toISOString(),
    };
  }

  private phoneDigest(phone: string): string {
    return createHmac("sha256", this.lookupSecret).update(phone).digest("hex");
  }

  private orderCode(): string {
    const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = randomBytes(10);
    let suffix = "";
    for (let index = 0; index < 10; index += 1) {
      suffix += alphabet[bytes[index]! % alphabet.length];
    }
    return `FAR-${date}-${suffix}`;
  }

  private notFound(): never {
    throw new ApiException(
      HttpStatus.NOT_FOUND,
      "ORDER_NOT_FOUND",
      "The order could not be found with the supplied information.",
    );
  }
}
