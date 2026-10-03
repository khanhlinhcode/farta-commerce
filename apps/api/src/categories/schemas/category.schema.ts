import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument, Types } from "mongoose";
import mongoose from "mongoose";

import {
  CATALOG_STATUSES,
  type CatalogStatus,
} from "../../catalog/catalog.constants";

@Schema({ _id: false, strict: "throw" })
export class CategorySeo {
  @Prop({ type: String, default: null, maxlength: 70 })
  title!: string | null;

  @Prop({ type: String, default: null, maxlength: 160 })
  description!: string | null;
}

const CategorySeoSchema = SchemaFactory.createForClass(CategorySeo);

@Schema({ collection: "categories", strict: "throw", timestamps: true })
export class Category {
  @Prop({ required: true, trim: true, minlength: 1, maxlength: 100 })
  name!: string;

  @Prop({ required: true, trim: true, lowercase: true, maxlength: 120 })
  slug!: string;

  @Prop({ type: String, default: null, maxlength: 2_000 })
  description!: string | null;

  @Prop({ type: mongoose.Schema.Types.ObjectId, default: null })
  imageMediaId!: Types.ObjectId | null;

  @Prop({ type: mongoose.Schema.Types.ObjectId, default: null })
  parentCategoryId!: Types.ObjectId | null;

  @Prop({
    required: true,
    type: String,
    enum: CATALOG_STATUSES,
    default: "DRAFT",
  })
  status!: CatalogStatus;

  @Prop({ required: true, type: Number, min: 0, max: 100_000, default: 0 })
  sortOrder!: number;

  @Prop({ type: CategorySeoSchema, default: () => ({}) })
  seo!: CategorySeo;

  @Prop({ required: true, type: mongoose.Schema.Types.ObjectId })
  createdBy!: Types.ObjectId;

  @Prop({ required: true, type: mongoose.Schema.Types.ObjectId })
  updatedBy!: Types.ObjectId;

  @Prop({ type: Date, default: null })
  archivedAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type CategoryDocument = HydratedDocument<Category>;
export const CategorySchema = SchemaFactory.createForClass(Category);
CategorySchema.index(
  { slug: 1 },
  { unique: true, name: "category_slug_unique" },
);
CategorySchema.index(
  { status: 1, parentCategoryId: 1, sortOrder: 1, _id: 1 },
  { name: "category_public_navigation" },
);
