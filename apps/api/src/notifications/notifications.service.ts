import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { ClientSession, Model } from "mongoose";

import { objectId } from "../catalog/catalog.utils";
import type { OrderDocument } from "../orders/schemas/order.schema";
import {
  NotificationEvent,
  type NotificationEventDocument,
  type NotificationEventType,
} from "./schemas/notification-event.schema";

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(NotificationEvent.name)
    private readonly events: Model<NotificationEventDocument>,
  ) {}

  async enqueueOrderEvent(
    type: NotificationEventType,
    order: OrderDocument,
    session: ClientSession,
  ): Promise<void> {
    // An order can legitimately receive a deposit and a later remaining
    // payment. Bind receipt events to the resulting payment state while
    // keeping lifecycle notifications one-per-order.
    const idempotencyKey =
      type === "PAYMENT_RECEIVED"
        ? `${type}:${order.id}:${order.paymentStatus}`
        : `${type}:${order.id}`;
    await this.events.updateOne(
      { idempotencyKey },
      {
        $setOnInsert: {
          type,
          aggregateType: "ORDER",
          aggregateId: order._id,
          orderCode: order.orderCode,
          recipientType: order.customerId ? "CUSTOMER" : "GUEST",
          customerId: order.customerId
            ? objectId(order.customerId.toString())
            : null,
          status: "PENDING",
          idempotencyKey,
          payload: {
            orderCode: order.orderCode,
            orderStatus: order.status,
            paymentStatus: order.paymentStatus,
          },
          attempts: 0,
          processedAt: null,
          lastErrorCode: null,
        },
      },
      { upsert: true, session },
    );
  }
}
