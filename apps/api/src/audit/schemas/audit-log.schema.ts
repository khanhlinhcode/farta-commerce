import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument, Types } from "mongoose";
import mongoose from "mongoose";

@Schema({ _id: false, strict: "throw" })
export class AuditChangeSummary {
  @Prop({ type: Object, default: null })
  before!: Record<string, unknown> | null;

  @Prop({ type: Object, default: null })
  after!: Record<string, unknown> | null;
}

const AuditChangeSummarySchema =
  SchemaFactory.createForClass(AuditChangeSummary);

@Schema({ collection: "audit_logs", strict: "throw", timestamps: true })
export class AuditLog {
  @Prop({ required: true, type: String, maxlength: 120 })
  action!: string;

  @Prop({ required: true, type: String, maxlength: 80 })
  resourceType!: string;

  @Prop({ required: true, type: String, maxlength: 120 })
  resourceId!: string;

  @Prop({ required: true, type: mongoose.Schema.Types.ObjectId })
  actorId!: Types.ObjectId;

  @Prop({ required: true, type: String, maxlength: 100 })
  requestId!: string;

  @Prop({ type: AuditChangeSummarySchema, default: null })
  changes!: AuditChangeSummary | null;

  @Prop({ type: String, default: null, maxlength: 500 })
  reason!: string | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type AuditLogDocument = HydratedDocument<AuditLog>;
export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
AuditLogSchema.index(
  { resourceType: 1, resourceId: 1, createdAt: -1 },
  { name: "audit_resource_time" },
);
AuditLogSchema.index(
  { actorId: 1, createdAt: -1 },
  { name: "audit_actor_time" },
);
