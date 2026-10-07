import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument, Types } from "mongoose";
import mongoose from "mongoose";

export const IDEMPOTENCY_STATUSES = ["IN_PROGRESS", "COMPLETED"] as const;
export type IdempotencyStatus = (typeof IDEMPOTENCY_STATUSES)[number];

@Schema({
  collection: "idempotency_records",
  strict: "throw",
  timestamps: true,
})
export class IdempotencyRecord {
  @Prop({ required: true, type: String, enum: ["CUSTOMER", "GUEST"] })
  realm!: "CUSTOMER" | "GUEST";

  @Prop({ required: true, type: String, maxlength: 128, select: false })
  ownerKey!: string;

  @Prop({ required: true, type: String, maxlength: 80 })
  operation!: string;

  @Prop({ required: true, type: String, maxlength: 64, select: false })
  keyHash!: string;

  @Prop({ required: true, type: String, maxlength: 64, select: false })
  requestHash!: string;

  @Prop({ required: true, type: String, enum: IDEMPOTENCY_STATUSES })
  status!: IdempotencyStatus;

  @Prop({ type: String, default: null, maxlength: 80 })
  resourceType!: string | null;

  @Prop({ type: mongoose.Schema.Types.ObjectId, default: null })
  resourceId!: Types.ObjectId | null;

  @Prop({ required: true, type: Date })
  expiresAt!: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

export type IdempotencyRecordDocument = HydratedDocument<IdempotencyRecord>;
export const IdempotencyRecordSchema =
  SchemaFactory.createForClass(IdempotencyRecord);
IdempotencyRecordSchema.index(
  { realm: 1, ownerKey: 1, operation: 1, keyHash: 1 },
  { unique: true, name: "idempotency_owner_operation_key_unique" },
);
IdempotencyRecordSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, name: "idempotency_expiry_ttl" },
);
