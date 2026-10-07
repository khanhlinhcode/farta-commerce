import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument, Types } from "mongoose";
import mongoose from "mongoose";

export const ORDER_STATUSES = [
  "CREATED",
  "CONFIRMED",
  "PACKING",
  "SHIPPING",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
  "PAYMENT_CONFLICT",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

@Schema({ _id: false, strict: "throw" })
export class OrderImageSnapshot {
  @Prop({ required: true, type: String, maxlength: 2048 })
  secureUrl!: string;

  @Prop({ required: true, type: Number, min: 1 })
  width!: number;

  @Prop({ required: true, type: Number, min: 1 })
  height!: number;

  @Prop({ type: String, default: null, maxlength: 300 })
  altText!: string | null;
}
const OrderImageSnapshotSchema =
  SchemaFactory.createForClass(OrderImageSnapshot);

@Schema({ _id: false, strict: "throw" })
export class OrderItemSnapshot {
  @Prop({ required: true, type: mongoose.Schema.Types.ObjectId })
  productId!: Types.ObjectId;

  @Prop({ required: true, type: mongoose.Schema.Types.ObjectId })
  variantId!: Types.ObjectId;

  @Prop({ required: true, type: String, maxlength: 160 })
  productName!: string;

  @Prop({ required: true, type: String, maxlength: 80 })
  sku!: string;

  @Prop({ required: true, type: String, maxlength: 80 })
  color!: string;

  @Prop({ required: true, type: String, maxlength: 40 })
  size!: string;

  @Prop({ required: true, type: Number, min: 0, max: Number.MAX_SAFE_INTEGER })
  unitPrice!: number;

  @Prop({ required: true, type: Number, min: 1, max: 100 })
  quantity!: number;

  @Prop({ required: true, type: Number, min: 0, max: Number.MAX_SAFE_INTEGER })
  lineSubtotal!: number;

  @Prop({ type: OrderImageSnapshotSchema, default: null })
  image!: OrderImageSnapshot | null;
}
const OrderItemSnapshotSchema = SchemaFactory.createForClass(OrderItemSnapshot);

@Schema({ _id: false, strict: "throw" })
export class ShippingSnapshot {
  @Prop({ required: true, type: String, maxlength: 100 })
  recipientName!: string;

  @Prop({ required: true, type: String, maxlength: 20 })
  phone!: string;

  @Prop({ required: true, type: String, maxlength: 300 })
  addressLine!: string;

  @Prop({ required: true, type: String, maxlength: 120 })
  provinceCity!: string;

  @Prop({ type: String, default: null, maxlength: 120 })
  district!: string | null;

  @Prop({ type: String, default: null, maxlength: 120 })
  ward!: string | null;

  @Prop({ required: true, type: String, enum: ["STANDARD"] })
  method!: "STANDARD";

  @Prop({ type: String, default: null, maxlength: 500 })
  notes!: string | null;
}
const ShippingSnapshotSchema = SchemaFactory.createForClass(ShippingSnapshot);

@Schema({ _id: false, strict: "throw" })
export class OrderStatusEntry {
  @Prop({ required: true, type: String, enum: ORDER_STATUSES })
  status!: OrderStatus;

  @Prop({ required: true, type: Date })
  at!: Date;

  @Prop({
    required: true,
    type: String,
    enum: ["CUSTOMER", "GUEST", "STAFF", "SYSTEM"],
  })
  actorType!: "CUSTOMER" | "GUEST" | "STAFF" | "SYSTEM";

  @Prop({ type: mongoose.Schema.Types.ObjectId, default: null })
  actorId!: Types.ObjectId | null;

  @Prop({ required: true, type: String, maxlength: 100 })
  requestId!: string;
}
const OrderStatusEntrySchema = SchemaFactory.createForClass(OrderStatusEntry);

@Schema({ collection: "orders", strict: "throw", timestamps: true })
export class Order {
  @Prop({ required: true, type: String, uppercase: true, maxlength: 40 })
  orderCode!: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, default: null })
  customerId!: Types.ObjectId | null;

  @Prop({ type: String, default: null, maxlength: 128, select: false })
  guestOwnerDigest!: string | null;

  @Prop({ required: true, type: String, maxlength: 64, select: false })
  lookupPhoneDigest!: string;

  @Prop({ required: true, type: mongoose.Schema.Types.ObjectId })
  cartId!: Types.ObjectId;

  @Prop({ required: true, type: String, enum: ORDER_STATUSES })
  status!: OrderStatus;

  @Prop({
    required: true,
    type: String,
    enum: [
      "UNPAID",
      "DEPOSIT_PAID",
      "FULLY_PAID",
      "FAILED",
      "EXPIRED",
      "REFUNDED",
      "CONFLICT",
    ],
  })
  paymentStatus!: string;

  @Prop({ required: true, type: String, enum: ["COD", "DEPOSIT", "FULL"] })
  paymentMethod!: "COD" | "DEPOSIT" | "FULL";

  @Prop({ required: true, type: [OrderItemSnapshotSchema], default: [] })
  items!: OrderItemSnapshot[];

  @Prop({ required: true, type: ShippingSnapshotSchema })
  shipping!: ShippingSnapshot;

  @Prop({ required: true, type: Number, min: 0, max: Number.MAX_SAFE_INTEGER })
  itemsSubtotal!: number;

  @Prop({ required: true, type: Number, min: 0, max: Number.MAX_SAFE_INTEGER })
  shippingFee!: number;

  @Prop({ required: true, type: Number, min: 0, max: Number.MAX_SAFE_INTEGER })
  total!: number;

  @Prop({ required: true, type: String, enum: ["VND"] })
  currency!: "VND";

  @Prop({ required: true, type: [OrderStatusEntrySchema], default: [] })
  statusHistory!: OrderStatusEntry[];

  @Prop({ required: true, type: mongoose.Schema.Types.ObjectId })
  idempotencyRecordId!: Types.ObjectId;

  createdAt!: Date;
  updatedAt!: Date;
}

export type OrderDocument = HydratedDocument<Order>;
export const OrderSchema = SchemaFactory.createForClass(Order);
OrderSchema.index(
  { orderCode: 1 },
  { unique: true, name: "order_code_unique" },
);
OrderSchema.index(
  { customerId: 1, createdAt: -1, _id: -1 },
  { name: "order_customer_time" },
);
OrderSchema.index(
  { status: 1, createdAt: -1, _id: -1 },
  { name: "order_status_time" },
);
OrderSchema.index(
  { idempotencyRecordId: 1 },
  { unique: true, name: "order_idempotency_unique" },
);
