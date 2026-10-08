import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument, Types } from "mongoose";
import mongoose from "mongoose";

export const NOTIFICATION_EVENT_TYPES = [
  "ORDER_CREATED",
  "PAYMENT_RECEIVED",
  "ORDER_CONFIRMED",
  "ORDER_SHIPPED",
  "ORDER_DELIVERED",
] as const;
export type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[number];

@Schema({
  collection: "notification_events",
  strict: "throw",
  timestamps: true,
})
export class NotificationEvent {
  @Prop({ required: true, type: String, enum: NOTIFICATION_EVENT_TYPES })
  type!: NotificationEventType;

  @Prop({ required: true, type: String, enum: ["ORDER"] })
  aggregateType!: "ORDER";

  @Prop({ required: true, type: mongoose.Schema.Types.ObjectId })
  aggregateId!: Types.ObjectId;

  @Prop({ required: true, type: String, maxlength: 40 })
  orderCode!: string;

  @Prop({ required: true, type: String, enum: ["CUSTOMER", "GUEST"] })
  recipientType!: "CUSTOMER" | "GUEST";

  @Prop({ type: mongoose.Schema.Types.ObjectId, default: null })
  customerId!: Types.ObjectId | null;

  @Prop({ required: true, type: String, enum: ["PENDING", "SENT", "FAILED"] })
  status!: "PENDING" | "SENT" | "FAILED";

  @Prop({ required: true, type: String, maxlength: 180 })
  idempotencyKey!: string;

  @Prop({ required: true, type: Object })
  payload!: Record<string, string>;

  @Prop({ required: true, type: Number, min: 0, max: 100, default: 0 })
  attempts!: number;

  @Prop({ type: Date, default: null })
  processedAt!: Date | null;

  @Prop({ type: String, default: null, maxlength: 300 })
  lastErrorCode!: string | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type NotificationEventDocument = HydratedDocument<NotificationEvent>;
export const NotificationEventSchema =
  SchemaFactory.createForClass(NotificationEvent);
NotificationEventSchema.index(
  { idempotencyKey: 1 },
  { unique: true, name: "notification_event_idempotency" },
);
NotificationEventSchema.index(
  { status: 1, createdAt: 1 },
  { name: "notification_pending_time" },
);
NotificationEventSchema.index(
  { aggregateType: 1, aggregateId: 1, createdAt: -1 },
  { name: "notification_aggregate_time" },
);
