import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument, Types } from "mongoose";
import mongoose from "mongoose";

export const INVENTORY_TRANSACTION_TYPES = [
  "IMPORT",
  "RESERVE",
  "RELEASE",
  "SALE",
  "RETURN",
  "ADJUSTMENT",
  "CORRECTION",
] as const;
export type InventoryTransactionType =
  (typeof INVENTORY_TRANSACTION_TYPES)[number];

@Schema({
  collection: "inventory_transactions",
  strict: "throw",
  timestamps: true,
})
export class InventoryTransaction {
  @Prop({ required: true, type: mongoose.Schema.Types.ObjectId })
  variantId!: Types.ObjectId;

  @Prop({ required: true, type: String, enum: INVENTORY_TRANSACTION_TYPES })
  type!: InventoryTransactionType;

  @Prop({ required: true, type: Number })
  quantityDelta!: number;

  @Prop({ required: true, type: String, minlength: 3, maxlength: 500 })
  reason!: string;

  @Prop({ type: String, default: null, maxlength: 80 })
  referenceType!: string | null;

  @Prop({ type: String, default: null, maxlength: 120 })
  referenceId!: string | null;

  @Prop({ required: true, type: mongoose.Schema.Types.ObjectId })
  actorId!: Types.ObjectId;

  @Prop({ required: true, type: String, maxlength: 100 })
  requestId!: string;

  @Prop({ required: true, type: String, maxlength: 160 })
  idempotencyKey!: string;

  @Prop({ required: true, type: Number, min: 0 })
  onHandAfter!: number;

  @Prop({ required: true, type: Number, min: 0 })
  reservedAfter!: number;

  createdAt!: Date;
  updatedAt!: Date;
}

export type InventoryTransactionDocument =
  HydratedDocument<InventoryTransaction>;
export const InventoryTransactionSchema =
  SchemaFactory.createForClass(InventoryTransaction);
InventoryTransactionSchema.index(
  { type: 1, idempotencyKey: 1 },
  { unique: true, name: "inventory_mutation_idempotency" },
);
InventoryTransactionSchema.index(
  { variantId: 1, createdAt: -1 },
  { name: "inventory_ledger_variant_time" },
);
