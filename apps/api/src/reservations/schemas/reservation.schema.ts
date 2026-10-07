import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument, Types } from "mongoose";
import mongoose from "mongoose";

export const RESERVATION_STATUSES = [
  "ACTIVE",
  "CONFIRMED",
  "RELEASED",
  "EXPIRED",
  "CANCELLED",
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

@Schema({
  collection: "inventory_reservations",
  strict: "throw",
  timestamps: true,
})
export class Reservation {
  @Prop({ required: true, type: mongoose.Schema.Types.ObjectId })
  variantId!: Types.ObjectId;

  @Prop({ required: true, type: Number, min: 1, max: 100 })
  quantity!: number;

  @Prop({ required: true, type: mongoose.Schema.Types.ObjectId })
  cartId!: Types.ObjectId;

  @Prop({ type: mongoose.Schema.Types.ObjectId, default: null })
  customerId!: Types.ObjectId | null;

  @Prop({ type: String, default: null, maxlength: 128, select: false })
  guestOwnerDigest!: string | null;

  @Prop({ required: true, type: String, enum: RESERVATION_STATUSES })
  status!: ReservationStatus;

  @Prop({ required: true, type: Date })
  expiresAt!: Date;

  @Prop({ type: Date, default: null })
  confirmedAt!: Date | null;

  @Prop({ type: Date, default: null })
  releasedAt!: Date | null;

  @Prop({ type: String, default: null, maxlength: 80 })
  referenceType!: string | null;

  @Prop({ type: mongoose.Schema.Types.ObjectId, default: null })
  referenceId!: Types.ObjectId | null;

  @Prop({ required: true, type: mongoose.Schema.Types.ObjectId })
  idempotencyRecordId!: Types.ObjectId;

  createdAt!: Date;
  updatedAt!: Date;
}

export type ReservationDocument = HydratedDocument<Reservation>;
export const ReservationSchema = SchemaFactory.createForClass(Reservation);
ReservationSchema.index(
  { status: 1, expiresAt: 1 },
  { name: "reservation_status_expiry" },
);
ReservationSchema.index(
  { referenceType: 1, referenceId: 1 },
  { name: "reservation_reference" },
);
ReservationSchema.index(
  { idempotencyRecordId: 1, variantId: 1 },
  { unique: true, name: "reservation_checkout_variant_unique" },
);
