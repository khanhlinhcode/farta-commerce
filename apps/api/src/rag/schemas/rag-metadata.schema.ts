import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

@Schema({ _id: false, strict: "throw" })
export class RagMetadata {
  @Prop({ type: String, default: null, maxlength: 120 })
  productSlug!: string | null;

  @Prop({ required: true, type: [String], default: [] })
  categoryIds!: string[];

  @Prop({ required: true, type: [String], default: [] })
  tags!: string[];
}

export const RagMetadataSchema = SchemaFactory.createForClass(RagMetadata);
