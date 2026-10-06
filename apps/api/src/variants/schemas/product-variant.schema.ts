import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument, Types } from "mongoose";
import mongoose from "mongoose";

import {
  VARIANT_STATUSES,
  type VariantStatus,
} from "../../catalog/catalog.constants";

@Schema({ collection: "product_variants", strict: "throw", timestamps: true })
export class ProductVariant {
  @Prop({ required: true, type: mongoose.Schema.Types.ObjectId })
  productId!: Types.ObjectId;

  @Prop({
    required: true,
    type: String,
    trim: true,
    uppercase: true,
    maxlength: 80,
  })
  sku!: string;

  @Prop({ required: true, type: String, trim: true, maxlength: 80 })
  color!: string;

  @Prop({ type: String, default: null, maxlength: 20 })
  colorCode!: string | null;

  @Prop({ required: true, type: String, trim: true, maxlength: 40 })
  size!: string;

  @Prop({ required: true, type: Number, min: 0, max: Number.MAX_SAFE_INTEGER })
  price!: number;

  @Prop({ type: Number, default: null, min: 0, max: Number.MAX_SAFE_INTEGER })
  compareAtPrice!: number | null;

  @Prop({
    required: true,
    type: String,
    enum: VARIANT_STATUSES,
    default: "ACTIVE",
  })
  status!: VariantStatus;

  @Prop({ required: true, type: [mongoose.Schema.Types.ObjectId], default: [] })
  mediaIds!: Types.ObjectId[];

  @Prop({ required: true, type: Number, min: 0, max: 1_000_000, default: 5 })
  lowStockThreshold!: number;

  @Prop({ required: true, type: mongoose.Schema.Types.ObjectId })
  createdBy!: Types.ObjectId;

  @Prop({ required: true, type: mongoose.Schema.Types.ObjectId })
  updatedBy!: Types.ObjectId;

  @Prop({ type: Date, default: null })
  archivedAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type ProductVariantDocument = HydratedDocument<ProductVariant>;
export const ProductVariantSchema =
  SchemaFactory.createForClass(ProductVariant);
ProductVariantSchema.index(
  { sku: 1 },
  { unique: true, name: "variant_sku_unique" },
);
ProductVariantSchema.index(
  { productId: 1, status: 1, _id: 1 },
  { name: "variant_product_status" },
);
