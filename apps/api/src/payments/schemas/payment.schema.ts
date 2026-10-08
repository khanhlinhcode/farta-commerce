import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument, Types } from "mongoose";
import mongoose from "mongoose";

import { PAYMENT_STATUSES, type PaymentStatus } from "../payment-status";

export { PAYMENT_STATUSES } from "../payment-status";
export type { PaymentStatus } from "../payment-status";

@Schema({ collection: "payments", strict: "throw", timestamps: true })
export class Payment {
  @Prop({ required: true, type: mongoose.Schema.Types.ObjectId })
  orderId!: Types.ObjectId;

  @Prop({ required: true, type: String, enum: ["COD", "SEPAY"] })
  provider!: "COD" | "SEPAY";

  @Prop({ required: true, type: String, enum: ["COD", "DEPOSIT", "FULL"] })
  method!: "COD" | "DEPOSIT" | "FULL";

  @Prop({ required: true, type: Number, min: 0, max: Number.MAX_SAFE_INTEGER })
  expectedAmount!: number;

  @Prop({ required: true, type: Number, min: 0, max: Number.MAX_SAFE_INTEGER })
  orderTotal!: number;

  @Prop({ required: true, type: Number, min: 0, max: Number.MAX_SAFE_INTEGER })
  receivedAmount!: number;

  @Prop({ required: true, type: String, enum: ["VND"] })
  currency!: "VND";

  @Prop({ required: true, type: String, enum: PAYMENT_STATUSES })
  status!: PaymentStatus;

  @Prop({ required: true, type: String, maxlength: 64, select: false })
  idempotencyKeyHash!: string;

  @Prop({ type: String, default: null, maxlength: 160 })
  providerTransactionId!: string | null;

  @Prop({ type: String, default: null, maxlength: 160 })
  providerReference!: string | null;

  @Prop({ required: true, type: [String], default: [] })
  providerTransactionIds!: string[];

  @Prop({ type: Object, default: null })
  providerPayloadSafeSummary!: Record<string, unknown> | null;

  @Prop({ required: true, type: Number, min: 0, max: Number.MAX_SAFE_INTEGER })
  codAmount!: number;

  @Prop({ type: Date, default: null })
  codCollectedAt!: Date | null;

  @Prop({ type: mongoose.Schema.Types.ObjectId, default: null })
  codCollectedBy!: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  expiresAt!: Date | null;

  @Prop({ type: String, default: null, maxlength: 160 })
  reconciliationReference!: string | null;

  @Prop({ type: String, default: null, maxlength: 500 })
  reconciliationReason!: string | null;

  @Prop({ type: mongoose.Schema.Types.ObjectId, default: null })
  reconciledBy!: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  reconciledAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type PaymentDocument = HydratedDocument<Payment>;
export const PaymentSchema = SchemaFactory.createForClass(Payment);
PaymentSchema.index(
  { orderId: 1 },
  { unique: true, name: "payment_order_unique" },
);
PaymentSchema.index(
  { provider: 1, providerReference: 1 },
  {
    unique: true,
    name: "payment_provider_reference_unique",
    partialFilterExpression: { providerReference: { $type: "string" } },
  },
);
PaymentSchema.index(
  { provider: 1, providerTransactionId: 1 },
  {
    unique: true,
    name: "payment_provider_transaction_unique",
    partialFilterExpression: { providerTransactionId: { $type: "string" } },
  },
);
