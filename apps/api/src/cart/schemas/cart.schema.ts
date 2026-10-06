import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument, Types } from "mongoose";
import mongoose from "mongoose";

import {
  CART_OWNER_TYPES,
  CART_STATUSES,
  type CartOwnerType,
  type CartStatus,
} from "../cart.constants";

@Schema({ strict: "throw", timestamps: true })
export class CartItem {
  _id!: Types.ObjectId;

  @Prop({ required: true, type: mongoose.Schema.Types.ObjectId })
  variantId!: Types.ObjectId;

  @Prop({ required: true, type: Number, min: 1, max: 100 })
  quantity!: number;

  createdAt!: Date;
  updatedAt!: Date;
}

const CartItemSchema = SchemaFactory.createForClass(CartItem);

@Schema({
  collection: "carts",
  strict: "throw",
  timestamps: true,
  versionKey: "version",
  optimisticConcurrency: true,
})
export class Cart {
  @Prop({ required: true, type: String, enum: CART_OWNER_TYPES })
  ownerType!: CartOwnerType;

  @Prop({ type: mongoose.Schema.Types.ObjectId, default: null })
  customerId!: Types.ObjectId | null;

  @Prop({ type: String, default: null, select: false })
  guestCredentialDigest!: string | null;

  @Prop({ required: true, type: String, enum: ["STOREFRONT"] })
  channel!: "STOREFRONT";

  @Prop({ required: true, type: String, enum: ["VND"] })
  currency!: "VND";

  @Prop({ required: true, type: String, enum: CART_STATUSES })
  status!: CartStatus;

  @Prop({ required: true, type: [CartItemSchema], default: [] })
  items!: CartItem[];

  @Prop({ required: true, type: Date })
  expiresAt!: Date;

  @Prop({ type: mongoose.Schema.Types.ObjectId, default: null })
  mergedIntoCartId!: Types.ObjectId | null;

  version!: number;
  createdAt!: Date;
  updatedAt!: Date;
}

export type CartDocument = HydratedDocument<Cart>;
export const CartSchema = SchemaFactory.createForClass(Cart);

CartSchema.index(
  { customerId: 1, channel: 1, currency: 1 },
  {
    unique: true,
    name: "cart_active_customer_unique",
    partialFilterExpression: { ownerType: "CUSTOMER", status: "ACTIVE" },
  },
);
CartSchema.index(
  { guestCredentialDigest: 1, channel: 1, currency: 1 },
  {
    unique: true,
    name: "cart_active_guest_unique",
    partialFilterExpression: { ownerType: "GUEST", status: "ACTIVE" },
  },
);
CartSchema.index({ status: 1, expiresAt: 1 }, { name: "cart_status_expiry" });
