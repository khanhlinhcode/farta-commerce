import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import { createHmac, randomBytes } from "node:crypto";
import type { ClientSession, Connection, Model } from "mongoose";
import mongoose from "mongoose";

import { AuditService } from "../audit/audit.service";
import { objectId } from "../catalog/catalog.utils";
import { ApiException } from "../common/api-exception";
import type { Environment } from "../config/environment";
import { NotificationsService } from "../notifications/notifications.service";
import {
  Payment,
  type PaymentDocument,
} from "../payments/schemas/payment.schema";
import {
  PaymentWebhookEvent,
  type PaymentWebhookEventDocument,
} from "../payments/schemas/payment-webhook-event.schema";
import { ReservationsService } from "../reservations/reservations.service";
import {
  Reservation,
  type ReservationDocument,
} from "../reservations/schemas/reservation.schema";
import type { AdminOrderListQueryDto } from "./dto/admin-order.dto";
import { assertOrderTransition } from "./order-state-machine";
import {
  Order,
  type OrderDocument,
  type OrderStatus,
} from "./schemas/order.schema";

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
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Order.name) private readonly orders: Model<OrderDocument>,
    @InjectModel(Payment.name)
    private readonly payments: Model<PaymentDocument>,
    @InjectModel(Reservation.name)
    private readonly reservationsModel: Model<ReservationDocument>,
    @InjectModel(PaymentWebhookEvent.name)
    private readonly webhookEvents: Model<PaymentWebhookEventDocument>,
    @Inject(ReservationsService)
    private readonly reservations: ReservationsService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(NotificationsService)
    private readonly notifications: NotificationsService,
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
      paymentMethod: "COD" | "DEPOSIT" | "FULL";
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
          paymentMethod: input.paymentMethod,
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

  async listAdmin(query: AdminOrderListQueryDto) {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.paymentStatus) filter.paymentStatus = query.paymentStatus;
    if (query.paymentMethod) filter.paymentMethod = query.paymentMethod;
    if (query.dateFrom || query.dateTo) {
      const createdAt: { $gte?: Date; $lte?: Date } = {};
      if (query.dateFrom) createdAt.$gte = new Date(query.dateFrom);
      if (query.dateTo) createdAt.$lte = new Date(query.dateTo);
      if (
        createdAt.$gte &&
        createdAt.$lte &&
        createdAt.$gte.getTime() > createdAt.$lte.getTime()
      ) {
        throw new ApiException(
          HttpStatus.BAD_REQUEST,
          "INVALID_ORDER_DATE_RANGE",
          "The order date range is invalid.",
        );
      }
      filter.createdAt = createdAt;
    }
    const q = query.q?.trim();
    if (q) {
      const pattern = new RegExp(this.escapeRegex(q), "i");
      Object.assign(
        filter,
        mongoose.trusted({
          $or: [{ orderCode: pattern }, { "shipping.phone": pattern }],
        }),
      );
    }
    const direction = query.sort === "oldest" ? 1 : -1;
    const [orders, total] = await Promise.all([
      this.orders
        .find(mongoose.trusted(filter))
        .sort({ createdAt: direction, _id: direction })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .exec(),
      this.orders.countDocuments(mongoose.trusted(filter)),
    ]);
    return {
      items: orders.map((order) => ({
        id: order.id,
        orderCode: order.orderCode,
        customerId: order.customerId?.toString() ?? null,
        recipientName: order.shipping.recipientName,
        phone: order.shipping.phone,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        currency: order.currency,
        itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
        total: order.total,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
      })),
      page: query.page,
      limit: query.limit,
      total,
      pages: Math.ceil(total / query.limit),
    };
  }

  async getAdmin(orderCode: string) {
    const order = await this.orders.findOne({ orderCode });
    if (!order) this.notFound();
    const [payment, reservations, webhookEvents, audit] = await Promise.all([
      this.payments.findOne({ orderId: order._id }),
      this.reservationsModel
        .find({ referenceType: "ORDER", referenceId: order._id })
        .sort({ createdAt: 1, _id: 1 }),
      this.webhookEvents
        .find({ orderId: order._id })
        .sort({ createdAt: -1, _id: -1 })
        .limit(50),
      this.audit.listForResource("Order", order.id),
    ]);
    return {
      ...this.serialize(order, payment),
      customerId: order.customerId?.toString() ?? null,
      recipientName: order.shipping.recipientName,
      phone: order.shipping.phone,
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      timeline: order.statusHistory.map((entry) => ({
        status: entry.status,
        at: entry.at.toISOString(),
        actorType: entry.actorType,
        actorId: entry.actorId?.toString() ?? null,
        requestId: entry.requestId,
      })),
      reservations: reservations.map((reservation) => ({
        id: reservation.id,
        variantId: reservation.variantId.toString(),
        quantity: reservation.quantity,
        status: reservation.status,
        expiresAt: reservation.expiresAt.toISOString(),
        confirmedAt: reservation.confirmedAt?.toISOString() ?? null,
        releasedAt: reservation.releasedAt?.toISOString() ?? null,
      })),
      paymentEvents: webhookEvents.map((event) => ({
        id: event.id,
        provider: event.provider,
        eventId: event.eventId,
        status: event.status,
        outcomeCode: event.outcomeCode,
        safeSummary: event.safeSummary,
        replayMismatchCount: event.replayMismatchCount,
        lastReplayMismatchAt: event.lastReplayMismatchAt?.toISOString() ?? null,
        createdAt: event.createdAt.toISOString(),
      })),
      audit,
    };
  }

  async transition(
    orderCode: string,
    nextStatus: OrderStatus,
    reason: string,
    actor: { userId: string; requestId: string },
  ) {
    if (["CANCELLED", "PAYMENT_CONFLICT"].includes(nextStatus)) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        "ORDER_TRANSITION_REQUIRES_DEDICATED_FLOW",
        "Use the dedicated cancellation or payment reconciliation flow.",
      );
    }
    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        const order = await this.orders.findOne({ orderCode }).session(session);
        if (!order) this.notFound();
        const payment = await this.payments
          .findOne({ orderId: order._id })
          .session(session);
        if (!payment) throw new Error("Order payment record was not found.");
        assertOrderTransition(order.status, nextStatus);
        this.assertOperationalTransition(order, payment, nextStatus);
        const previous = order.status;
        if (nextStatus === "SHIPPING") {
          await this.reservations.commitSaleForOrder(
            order.id,
            { requestId: actor.requestId, actorId: actor.userId },
            session,
          );
        }
        order.status = nextStatus;
        order.statusHistory.push({
          status: nextStatus,
          at: new Date(),
          actorType: "STAFF",
          actorId: objectId(actor.userId),
          requestId: actor.requestId,
        });
        await order.save({ session });
        await this.audit.record(
          {
            action: "order.transition",
            resourceType: "Order",
            resourceId: order.id,
            actorId: actor.userId,
            requestId: actor.requestId,
            before: { status: previous },
            after: { status: nextStatus },
            reason: reason.trim(),
          },
          session,
        );
        const notificationType =
          nextStatus === "CONFIRMED"
            ? "ORDER_CONFIRMED"
            : nextStatus === "SHIPPING"
              ? "ORDER_SHIPPED"
              : nextStatus === "DELIVERED"
                ? "ORDER_DELIVERED"
                : null;
        if (notificationType) {
          await this.notifications.enqueueOrderEvent(
            notificationType,
            order,
            session,
          );
        }
      });
    } finally {
      await session.endSession();
    }
    return this.getAdmin(orderCode);
  }

  async cancel(
    orderCode: string,
    reason: string,
    actor: { userId: string; requestId: string },
  ) {
    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        const order = await this.orders.findOne({ orderCode }).session(session);
        if (!order) this.notFound();
        const payment = await this.payments
          .findOne({ orderId: order._id })
          .session(session);
        if (!payment) throw new Error("Order payment record was not found.");
        assertOrderTransition(order.status, "CANCELLED");
        if (
          !["UNPAID", "FAILED", "EXPIRED", "REFUNDED"].includes(
            payment.status,
          ) ||
          payment.codCollectedAt
        ) {
          throw new ApiException(
            HttpStatus.CONFLICT,
            "ORDER_CANCELLATION_PAYMENT_CONFLICT",
            "Paid or unsettled orders require payment reconciliation first.",
          );
        }
        const previous = order.status;
        await this.reservations.cancelForOrder(
          order.id,
          {
            requestId: actor.requestId,
            actorId: actor.userId,
            reason: reason.trim(),
          },
          session,
        );
        order.status = "CANCELLED";
        order.statusHistory.push({
          status: "CANCELLED",
          at: new Date(),
          actorType: "STAFF",
          actorId: objectId(actor.userId),
          requestId: actor.requestId,
        });
        await order.save({ session });
        await this.audit.record(
          {
            action: "order.cancel",
            resourceType: "Order",
            resourceId: order.id,
            actorId: actor.userId,
            requestId: actor.requestId,
            before: { status: previous },
            after: { status: "CANCELLED" },
            reason: reason.trim(),
          },
          session,
        );
      });
    } finally {
      await session.endSession();
    }
    return this.getAdmin(orderCode);
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
            expectedAmount: payment.expectedAmount,
            orderTotal: payment.orderTotal,
            receivedAmount: payment.receivedAmount,
            reference: payment.providerReference,
            expiresAt: payment.expiresAt?.toISOString() ?? null,
            transactionReference: payment.providerTransactionId,
            reconciliationState: payment.status,
            reconciliationReference: payment.reconciliationReference,
            reconciliationReason: payment.reconciliationReason,
            reconciledBy: payment.reconciledBy?.toString() ?? null,
            reconciledAt: payment.reconciledAt?.toISOString() ?? null,
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

  private assertOperationalTransition(
    order: OrderDocument,
    payment: PaymentDocument,
    nextStatus: OrderStatus,
  ): void {
    if (nextStatus === "CONFIRMED" && payment.provider !== "COD") {
      throw new ApiException(
        HttpStatus.CONFLICT,
        "ONLINE_PAYMENT_REQUIRES_WEBHOOK",
        "Online orders are confirmed only by verified payment processing.",
      );
    }
    if (
      nextStatus === "PACKING" &&
      payment.provider !== "COD" &&
      !["DEPOSIT_PAID", "FULLY_PAID"].includes(payment.status)
    ) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        "ORDER_PAYMENT_NOT_READY",
        "The online payment is not ready for packing.",
      );
    }
    if (order.status === "PAYMENT_CONFLICT") {
      throw new ApiException(
        HttpStatus.CONFLICT,
        "PAYMENT_RECONCILIATION_REQUIRED",
        "Resolve the payment conflict before order fulfillment.",
      );
    }
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
