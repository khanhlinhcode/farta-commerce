import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";
import { Types } from "mongoose";

import { REALMS, type AuthRealm } from "../auth.constants";

@Schema({ collection: "sessions", strict: "throw", timestamps: true })
export class Session {
  @Prop({ required: true, type: Types.ObjectId, ref: "User", index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, type: String, enum: REALMS })
  realm!: AuthRealm;

  @Prop({ required: true })
  familyId!: string;

  @Prop({ required: true, select: false })
  refreshDigest!: string;

  @Prop({ required: true, min: 0, default: 0 })
  rotationCounter!: number;

  @Prop({ required: true, min: 1 })
  rolesVersion!: number;

  @Prop({ required: true })
  lastActivityAt!: Date;

  @Prop({ required: true })
  idleExpiresAt!: Date;

  @Prop({ required: true })
  absoluteExpiresAt!: Date;

  @Prop({ type: Date, default: null })
  revokedAt!: Date | null;

  @Prop({ type: String, default: null, maxlength: 120 })
  revocationReason!: string | null;

  @Prop({ type: String, default: null, maxlength: 160 })
  deviceLabel!: string | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type SessionDocument = HydratedDocument<Session>;
export const SessionSchema = SchemaFactory.createForClass(Session);
SessionSchema.index(
  { userId: 1, realm: 1, revokedAt: 1, absoluteExpiresAt: 1 },
  { name: "session_active_by_user" },
);
SessionSchema.index(
  { familyId: 1 },
  { unique: true, name: "session_family_unique" },
);
