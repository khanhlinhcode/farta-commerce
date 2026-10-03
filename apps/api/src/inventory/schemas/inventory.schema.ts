import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument, Types } from "mongoose";
import mongoose from "mongoose";

@Schema({ collection: "inventory", strict: "throw", timestamps: true })
export class Inventory {
  @Prop({ required: true, type: mongoose.Schema.Types.ObjectId })
  variantId!: Types.ObjectId;

  @Prop({ required: true, type: Number, min: 0, default: 0 })
  onHand!: number;

  @Prop({ required: true, type: Number, min: 0, default: 0 })
  reserved!: number;

  createdAt!: Date;
  updatedAt!: Date;
}

export type InventoryDocument = HydratedDocument<Inventory>;
export const InventorySchema = SchemaFactory.createForClass(Inventory);
InventorySchema.index(
  { variantId: 1 },
  { unique: true, name: "inventory_variant_unique" },
);
