import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument, Types } from "mongoose";
import mongoose from "mongoose";

import {
  CATALOG_STATUSES,
  type CatalogStatus,
} from "../../catalog/catalog.constants";

@Schema({ _id: false, strict: "throw" })
export class ProductSeo {
  @Prop({ type: String, default: null, maxlength: 70 })
  title!: string | null;

  @Prop({ type: String, default: null, maxlength: 160 })
  description!: string | null;
}
const ProductSeoSchema = SchemaFactory.createForClass(ProductSeo);

@Schema({ collection: "products", strict: "throw", timestamps: true })
export class Product {
  @Prop({ required: true, trim: true, minlength: 1, maxlength: 160 })
  name!: string;

  @Prop({ required: true, trim: true, lowercase: true, maxlength: 120 })
  slug!: string;

  @Prop({ type: String, default: null, maxlength: 500 })
  shortDescription!: string | null;

  @Prop({ type: String, default: null, maxlength: 10_000 })
  description!: string | null;

  @Prop({ required: true, type: [mongoose.Schema.Types.ObjectId], default: [] })
  categoryIds!: Types.ObjectId[];

  @Prop({
    required: true,
    type: String,
    enum: CATALOG_STATUSES,
    default: "DRAFT",
  })
  status!: CatalogStatus;

  @Prop({ required: true, type: [String], default: [] })
  tags!: string[];

  @Prop({ type: mongoose.Schema.Types.ObjectId, default: null })
  coverMediaId!: Types.ObjectId | null;

  @Prop({ required: true, type: [mongoose.Schema.Types.ObjectId], default: [] })
  mediaIds!: Types.ObjectId[];

  @Prop({ type: ProductSeoSchema, default: () => ({}) })
  seo!: ProductSeo;

  @Prop({ type: Date, default: null })
  publishedAt!: Date | null;

  @Prop({ required: true, type: mongoose.Schema.Types.ObjectId })
  createdBy!: Types.ObjectId;

  @Prop({ required: true, type: mongoose.Schema.Types.ObjectId })
  updatedBy!: Types.ObjectId;

  @Prop({ type: Date, default: null })
  archivedAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type ProductDocument = HydratedDocument<Product>;
export const ProductSchema = SchemaFactory.createForClass(Product);
ProductSchema.index({ slug: 1 }, { unique: true, name: "product_slug_unique" });
ProductSchema.index(
  { status: 1, categoryIds: 1, publishedAt: -1, _id: 1 },
  { name: "product_public_catalog" },
);
