import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument, Types } from "mongoose";
import mongoose from "mongoose";

import {
  CATALOG_STATUSES,
  type CatalogStatus,
} from "../../catalog/catalog.constants";

@Schema({ collection: "banners", strict: "throw", timestamps: true })
export class Banner {
  @Prop({ required: true, type: String, trim: true, maxlength: 160 })
  title!: string;

  @Prop({ type: String, default: null, maxlength: 500 })
  subtitle!: string | null;

  @Prop({ required: true, type: mongoose.Schema.Types.ObjectId })
  desktopMediaId!: Types.ObjectId;

  @Prop({ type: mongoose.Schema.Types.ObjectId, default: null })
  mobileMediaId!: Types.ObjectId | null;

  @Prop({ type: String, default: null, maxlength: 80 })
  ctaLabel!: string | null;

  @Prop({ type: String, default: null, maxlength: 500 })
  ctaTarget!: string | null;

  @Prop({ required: true, type: String, maxlength: 80 })
  position!: string;

  @Prop({ required: true, type: Number, min: 0, max: 100_000, default: 0 })
  priority!: number;

  @Prop({ type: Date, default: null })
  startAt!: Date | null;

  @Prop({ type: Date, default: null })
  endAt!: Date | null;

  @Prop({
    required: true,
    type: String,
    enum: CATALOG_STATUSES,
    default: "DRAFT",
  })
  status!: CatalogStatus;

  @Prop({ required: true, type: mongoose.Schema.Types.ObjectId })
  createdBy!: Types.ObjectId;

  @Prop({ required: true, type: mongoose.Schema.Types.ObjectId })
  updatedBy!: Types.ObjectId;

  @Prop({ type: Date, default: null })
  archivedAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type BannerDocument = HydratedDocument<Banner>;
export const BannerSchema = SchemaFactory.createForClass(Banner);
BannerSchema.index(
  { status: 1, position: 1, startAt: 1, endAt: 1, priority: -1 },
  { name: "banner_public_schedule" },
);
