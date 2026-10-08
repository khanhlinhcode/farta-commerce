import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import { createHash, timingSafeEqual } from "node:crypto";
import type { ClientSession, Connection, Model } from "mongoose";

import { isDuplicateKey, objectId } from "../catalog/catalog.utils";
import { ApiException } from "../common/api-exception";
import type { Environment } from "../config/environment";
import { assertOrderTransition } from "../orders/order-state-machine";
import { Order, type OrderDocument } from "../orders/schemas/order.schema";
import { ReservationsService } from "../reservations/reservations.service";
import {
  Reservation,
  type ReservationDocument,
} from "../reservations/schemas/reservation.schema";
import { assertPaymentTransition } from "./payment-state-machine";
import {
  PaymentProvider,
  type NormalizedPaymentEvent,
} from "./providers/payment-provider";
import { SePayPaymentProvider } from "./providers/sepay-payment.provider";
import {
  PaymentWebhookEvent,
  type PaymentWebhookEventDocument,
} from "./schemas/payment-webhook-event.schema";
import { Payment, type PaymentDocument } from "./schemas/payment.schema";

export type PaymentOwner =
  | { type: "CUSTOMER"; customerId: string }
  | { type: "GUEST"; guestOwnerDigest: string };

@Injectable()
export class PaymentsService {
  private readonly sepayEnabled: boolean;
  private readonly paymentCodePrefix: string;
  private readonly depositMode: "DISABLED" | "FIXED" | "PERCENTAGE";
  private readonly depositFixed: number | null;
  private readonly depositBasisPoints: number | null;
  private readonly onlinePaymentTtl: number;

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Payment.name)
    private readonly payments: Model<PaymentDocument>,
    @InjectModel(Order.name) private readonly orders: Model<OrderDocument>,
    @InjectModel(Reservation.name)
    private readonly reservationModel: Model<ReservationDocument>,
    @InjectModel(PaymentWebhookEvent.name)
    private readonly webhookEvents: Model<PaymentWebhookEventDocument>,
    @Inject(ReservationsService)
    private readonly reservations: ReservationsService,
    @Inject(PaymentProvider) private readonly provider: PaymentProvider,
    @Inject(SePayPaymentProvider)
    private readonly sepayProvider: SePayPaymentProvider,
    @Inject(ConfigService) config: ConfigService<Environment, true>,
  ) {
    this.sepayEnabled = config.get("SEPAY_ENABLED", { infer: true });
    this.paymentCodePrefix = config.get("SEPAY_PAYMENT_CODE_PREFIX", {
      infer: true,
    });
    this.depositMode = config.get("SEPAY_DEPOSIT_MODE", { infer: true });
    this.depositFixed = config.get("SEPAY_DEPOSIT_FIXED_VND", { infer: true });
    this.depositBasisPoints = config.get("SEPAY_DEPOSIT_BASIS_POINTS", {
      infer: true,
    });
    this.onlinePaymentTtl = config.get("CHECKOUT_RESERVATION_TTL_SECONDS", {
      infer: true,
    });
  }

  supportedMethods(total: number): ReadonlyArray<"COD" | "DEPOSIT" | "FULL"> {
    const methods: Array<"COD" | "DEPOSIT" | "FULL"> = ["COD"];
    if (this.sepayEnabled) {
      methods.push("FULL");
      if (this.depositAmount(total) !== null) methods.push("DEPOSIT");
    }
    return methods;
  }

  paymentAmounts(total: number): {
    COD: number;
    FULL?: number;
    DEPOSIT?: number;
  } {
    const amounts: { COD: number; FULL?: number; DEPOSIT?: number } = {
      COD: total,
    };
    if (this.sepayEnabled) {
      amounts.FULL = total;
      const deposit = this.depositAmount(total);
      if (deposit !== null) amounts.DEPOSIT = deposit;
    }
    return amounts;
  }

  async createForCheckout(
    order: OrderDocument,
    method: "COD" | "DEPOSIT" | "FULL",
    amount: number,
    idempotencyKey: string,
    expiresAt: Date,
    session: ClientSession,
  ): Promise<PaymentDocument> {
    const online = method !== "COD";
    const [payment] = await this.payments.create(
      [
        {
          orderId: order._id,
          provider: online ? "SEPAY" : "COD",
          method,
          expectedAmount: amount,
          orderTotal: order.total,
          receivedAmount: 0,
          currency: "VND",
          status: "UNPAID",
          idempotencyKeyHash: createHash("sha256")
            .update(idempotencyKey)
            .digest("hex"),
          providerTransactionId: null,
          providerTransactionIds: [],
          providerReference: online
            ? `${this.paymentCodePrefix}${order.orderCode
                .replace(/^FAR-/, "")
                .replaceAll("-", "")}`
            : null,
          providerPayloadSafeSummary: null,
          codAmount: method === "COD" ? order.total : 0,
          codCollectedAt: null,
          codCollectedBy: null,
          expiresAt: online ? expiresAt : null,
        },
      ],
      { session },
    );
    if (!payment) throw new Error("Payment was not created.");
    return payment;
  }

  async initiate(orderCode: string, owner: PaymentOwner) {
    const { order, payment } = await this.ownedPayment(orderCode, owner);
    if (payment.provider !== "SEPAY") {
      throw new ApiException(
        HttpStatus.CONFLICT,
        "PAYMENT_METHOD_NOT_ONLINE",
        "This order does not use online payment.",
      );
    }
    if (!["UNPAID", "DEPOSIT_PAID"].includes(payment.status)) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        "PAYMENT_NOT_INITIABLE",
        "This payment cannot be initiated in its current state.",
      );
    }
    if (payment.expiresAt && payment.expiresAt.getTime() <= Date.now()) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        "PAYMENT_EXPIRED",
        "The payment window has expired.",
      );
    }
    return {
      orderCode: order.orderCode,
      status: payment.status,
      receivedAmount: payment.receivedAmount,
      orderTotal: payment.orderTotal,
      instructions: this.provider.initiate(payment, this.amountDue(payment)),
    };
  }

  async status(orderCode: string, owner: PaymentOwner) {
    const { order, payment } = await this.ownedPayment(orderCode, owner);
    return {
      orderCode: order.orderCode,
      provider: payment.provider,
      method: payment.method,
      status: payment.status,
      currency: payment.currency,
      expectedAmount: payment.expectedAmount,
      receivedAmount: payment.receivedAmount,
      orderTotal: payment.orderTotal,
      amountDue: this.amountDue(payment),
      reference: payment.providerReference,
      expiresAt: payment.expiresAt?.toISOString() ?? null,
      updatedAt: payment.updatedAt.toISOString(),
    };
  }

  async processWebhook(
    event: NormalizedPaymentEvent,
    requestId: string,
  ): Promise<{ success: true }> {
    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        const [record] = await this.webhookEvents.create(
          [
            {
              provider: "SEPAY",
              eventId: event.eventId,
              payloadHash: event.payloadHash,
              paymentId: null,
              orderId: null,
              status: "CONFLICT",
              outcomeCode: "PROCESSING",
              safeSummary: event.safeSummary,
            },
          ],
          { session },
        );
        if (!record) throw new Error("Webhook event was not created.");
        const payment = event.reference
          ? await this.payments
              .findOne({
                provider: "SEPAY",
                providerReference: event.reference,
              })
              .session(session)
          : null;
        if (!payment) {
          record.outcomeCode = "UNKNOWN_PAYMENT_REFERENCE";
          await record.save({ session });
          return;
        }
        const order = await this.orders
          .findById(payment.orderId)
          .session(session);
        if (!order) {
          record.paymentId = payment._id;
          record.outcomeCode = "ORDER_NOT_FOUND";
          await record.save({ session });
          return;
        }
        record.paymentId = payment._id;
        record.orderId = order._id;
        const validationConflict = this.eventConflict(event, payment, order);
        if (validationConflict) {
          await this.markConflict(
            record,
            payment,
            order,
            event,
            validationConflict,
            requestId,
            session,
          );
          return;
        }
        const next = this.nextReceipt(payment, event.amount);
        if (!next) {
          await this.markConflict(
            record,
            payment,
            order,
            event,
            "PAYMENT_AMOUNT_MISMATCH",
            requestId,
            session,
          );
          return;
        }
        if (payment.status === "UNPAID") {
          const reservationSet = await this.reservationModel
            .find({ referenceType: "ORDER", referenceId: order._id })
            .session(session);
          const now = Date.now();
          if (
            reservationSet.length === 0 ||
            reservationSet.some(
              (reservation) =>
                reservation.status !== "ACTIVE" ||
                reservation.expiresAt.getTime() <= now,
            )
          ) {
            await this.markConflict(
              record,
              payment,
              order,
              event,
              "PAYMENT_AFTER_RESERVATION_EXPIRY",
              requestId,
              session,
            );
            return;
          }
          await this.reservations.confirm(
            reservationSet.map((reservation) => reservation._id),
            order.id,
            session,
          );
        }
        assertPaymentTransition(payment.status, next.status);
        payment.receivedAmount = next.receivedAmount;
        payment.status = next.status;
        payment.providerTransactionId ??= event.eventId;
        payment.providerTransactionIds = this.appendTransactionId(
          payment.providerTransactionIds,
          event.eventId,
        );
        payment.providerPayloadSafeSummary = event.safeSummary;
        payment.expiresAt =
          next.status === "DEPOSIT_PAID"
            ? new Date(Date.now() + this.onlinePaymentTtl * 1000)
            : null;
        await payment.save({ session });

        order.paymentStatus = next.status;
        if (order.status === "CREATED") {
          assertOrderTransition(order.status, "CONFIRMED");
          order.status = "CONFIRMED";
          order.statusHistory.push({
            status: "CONFIRMED",
            at: new Date(),
            actorType: "SYSTEM",
            actorId: null,
            requestId,
          });
        }
        await order.save({ session });
        record.status = "PROCESSED";
        record.outcomeCode = next.status;
        await record.save({ session });
      });
    } catch (error) {
      if (isDuplicateKey(error)) {
        const duplicateEvent = await this.webhookEvents
          .findOne({ provider: event.provider, eventId: event.eventId })
          .select("+payloadHash");
        if (duplicateEvent) {
          const existingHash = Buffer.from(duplicateEvent.payloadHash, "hex");
          const replayHash = Buffer.from(event.payloadHash, "hex");
          if (
            existingHash.length === replayHash.length &&
            timingSafeEqual(existingHash, replayHash)
          ) {
            return { success: true };
          }
          await this.webhookEvents.updateOne(
            { _id: duplicateEvent._id },
            {
              $inc: { replayMismatchCount: 1 },
              $set: { lastReplayMismatchAt: new Date() },
            },
          );
          throw new ApiException(
            HttpStatus.CONFLICT,
            "SEPAY_WEBHOOK_REPLAY_MISMATCH",
            "Webhook replay did not match the accepted event.",
          );
        }
      }
      throw error;
    } finally {
      await session.endSession();
    }
    return { success: true };
  }

  private depositAmount(total: number): number | null {
    if (!this.sepayEnabled || this.depositMode === "DISABLED") return null;
    const amount =
      this.depositMode === "FIXED"
        ? this.depositFixed
        : this.depositBasisPoints === null
          ? null
          : Math.ceil((total * this.depositBasisPoints) / 10_000);
    if (
      amount === null ||
      !Number.isSafeInteger(amount) ||
      amount <= 0 ||
      amount >= total
    ) {
      return null;
    }
    return amount;
  }

  private async ownedPayment(orderCode: string, owner: PaymentOwner) {
    const ownership =
      owner.type === "CUSTOMER"
        ? { customerId: objectId(owner.customerId) }
        : { customerId: null, guestOwnerDigest: owner.guestOwnerDigest };
    const order = await this.orders
      .findOne({ orderCode, ...ownership })
      .select(owner.type === "GUEST" ? "+guestOwnerDigest" : "");
    if (!order) this.notFound();
    const payment = await this.payments.findOne({ orderId: order._id });
    if (!payment) this.notFound();
    return { order, payment };
  }

  private amountDue(payment: PaymentDocument): number {
    if (payment.status === "FULLY_PAID" || payment.status === "REFUNDED") {
      return 0;
    }
    if (payment.status === "DEPOSIT_PAID") {
      return payment.orderTotal - payment.receivedAmount;
    }
    return payment.expectedAmount;
  }

  private nextReceipt(
    payment: PaymentDocument,
    amount: number,
  ): { status: "DEPOSIT_PAID" | "FULLY_PAID"; receivedAmount: number } | null {
    if (payment.status === "UNPAID") {
      if (amount === payment.orderTotal) {
        return { status: "FULLY_PAID", receivedAmount: amount };
      }
      if (payment.method === "DEPOSIT" && amount === payment.expectedAmount) {
        return { status: "DEPOSIT_PAID", receivedAmount: amount };
      }
      return null;
    }
    if (payment.status === "DEPOSIT_PAID") {
      const remaining = payment.orderTotal - payment.receivedAmount;
      return amount === remaining
        ? { status: "FULLY_PAID", receivedAmount: payment.orderTotal }
        : null;
    }
    return null;
  }

  private eventConflict(
    event: NormalizedPaymentEvent,
    payment: PaymentDocument,
    order: OrderDocument,
  ): string | null {
    if (event.transferType !== "in") return "PAYMENT_DIRECTION_MISMATCH";
    if (event.accountNumber !== this.sepayProvider.expectedAccountNumber()) {
      return "PAYMENT_ACCOUNT_MISMATCH";
    }
    if (event.currency !== payment.currency) return "PAYMENT_CURRENCY_MISMATCH";
    if (payment.expiresAt && payment.expiresAt.getTime() <= Date.now()) {
      return "PAYMENT_WINDOW_EXPIRED";
    }
    if (["CANCELLED", "COMPLETED", "PAYMENT_CONFLICT"].includes(order.status)) {
      return "PAYMENT_ORDER_STATE_CONFLICT";
    }
    if (
      [
        "FULLY_PAID",
        "FAILED",
        "EXPIRED",
        "REFUND_PENDING",
        "REFUNDED",
        "CONFLICT",
      ].includes(payment.status)
    ) {
      return "PAYMENT_STATE_CONFLICT";
    }
    return null;
  }

  private async markConflict(
    record: PaymentWebhookEventDocument,
    payment: PaymentDocument,
    order: OrderDocument,
    event: NormalizedPaymentEvent,
    code: string,
    requestId: string,
    session: ClientSession,
  ): Promise<void> {
    payment.providerTransactionId ??= event.eventId;
    if (!payment.providerTransactionIds.includes(event.eventId)) {
      payment.providerTransactionIds = this.appendTransactionId(
        payment.providerTransactionIds,
        event.eventId,
      );
    }
    payment.providerPayloadSafeSummary = event.safeSummary;
    const preserveSettledRefund = payment.status === "REFUNDED";
    if (payment.status !== "CONFLICT" && !preserveSettledRefund) {
      assertPaymentTransition(payment.status, "CONFLICT");
      payment.status = "CONFLICT";
    }
    await payment.save({ session });
    if (!preserveSettledRefund) {
      order.paymentStatus = "CONFLICT";
      if (["CREATED", "CONFIRMED"].includes(order.status)) {
        assertOrderTransition(order.status, "PAYMENT_CONFLICT");
        order.status = "PAYMENT_CONFLICT";
        order.statusHistory.push({
          status: "PAYMENT_CONFLICT",
          at: new Date(),
          actorType: "SYSTEM",
          actorId: null,
          requestId,
        });
      }
      await order.save({ session });
    }
    record.status = "CONFLICT";
    record.outcomeCode = code;
    await record.save({ session });
  }

  private appendTransactionId(
    current: ReadonlyArray<string>,
    eventId: string,
  ): string[] {
    if (current.includes(eventId)) return [...current];
    return [...current, eventId].slice(-10);
  }

  private notFound(): never {
    throw new ApiException(
      HttpStatus.NOT_FOUND,
      "PAYMENT_NOT_FOUND",
      "The payment could not be found with the supplied information.",
    );
  }
}
