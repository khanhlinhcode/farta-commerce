import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument, Types } from "mongoose";
import mongoose from "mongoose";

export const PAYMENT_WEBHOOK_EVENT_STATUSES = [
  "PROCESSED",
  "CONFLICT",
] as const;

@Schema({
  collection: "payment_webhook_events",
  strict: "throw",
  timestamps: true,
})
export class PaymentWebhookEvent {
  @Prop({ required: true, type: String, enum: ["SEPAY"] })
  provider!: "SEPAY";

  @Prop({ required: true, type: String, maxlength: 160 })
  eventId!: string;

  @Prop({ required: true, type: String, maxlength: 64, select: false })
  payloadHash!: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, default: null })
  paymentId!: Types.ObjectId | null;

  @Prop({ type: mongoose.Schema.Types.ObjectId, default: null })
  orderId!: Types.ObjectId | null;

  @Prop({
    required: true,
    type: String,
    enum: PAYMENT_WEBHOOK_EVENT_STATUSES,
  })
  status!: (typeof PAYMENT_WEBHOOK_EVENT_STATUSES)[number];

  @Prop({ type: String, default: null, maxlength: 80 })
  outcomeCode!: string | null;

  @Prop({ required: true, type: Object })
  safeSummary!: Record<string, unknown>;

  @Prop({ required: true, type: Number, min: 0, default: 0 })
  replayMismatchCount!: number;

  @Prop({ type: Date, default: null })
  lastReplayMismatchAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type PaymentWebhookEventDocument = HydratedDocument<PaymentWebhookEvent>;
export const PaymentWebhookEventSchema =
  SchemaFactory.createForClass(PaymentWebhookEvent);
PaymentWebhookEventSchema.index(
  { provider: 1, eventId: 1 },
  { unique: true, name: "payment_webhook_provider_event_unique" },
);
PaymentWebhookEventSchema.index(
  { status: 1, createdAt: -1, _id: -1 },
  { name: "payment_webhook_status_time" },
);
