import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument, Types } from "mongoose";
import mongoose from "mongoose";

@Schema({ collection: "media_assets", strict: "throw", timestamps: true })
export class MediaAsset {
  @Prop({ required: true, type: String, enum: ["CLOUDINARY"] })
  provider!: "CLOUDINARY";

  @Prop({ required: true, trim: true, maxlength: 500 })
  publicId!: string;

  @Prop({ required: true, trim: true, maxlength: 2_000 })
  secureUrl!: string;

  @Prop({ required: true, type: String, enum: ["image"] })
  resourceType!: "image";

  @Prop({ required: true, trim: true, lowercase: true, maxlength: 20 })
  format!: string;

  @Prop({ required: true, type: Number, min: 1, max: 12_000 })
  width!: number;

  @Prop({ required: true, type: Number, min: 1, max: 12_000 })
  height!: number;

  @Prop({ required: true, type: Number, min: 1 })
  bytes!: number;

  @Prop({ type: String, default: null, maxlength: 255 })
  originalFilename!: string | null;

  @Prop({ type: String, default: null, maxlength: 500 })
  altText!: string | null;

  @Prop({ required: true, type: mongoose.Schema.Types.ObjectId })
  createdBy!: Types.ObjectId;

  @Prop({ type: Date, default: null })
  archivedAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type MediaAssetDocument = HydratedDocument<MediaAsset>;
export const MediaAssetSchema = SchemaFactory.createForClass(MediaAsset);
MediaAssetSchema.index(
  { publicId: 1 },
  { unique: true, name: "media_public_id_unique" },
);
MediaAssetSchema.index(
  { archivedAt: 1, createdAt: -1 },
  { name: "media_active_time" },
);
