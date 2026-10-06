import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

import {
  PERMISSIONS,
  ROLES,
  USER_STATUSES,
  type AuthRole,
  type Permission,
  type UserStatus,
} from "../auth.constants";

@Schema({ collection: "users", strict: "throw", timestamps: true })
export class User {
  @Prop({ required: true, type: String, trim: true, lowercase: true })
  normalizedEmail!: string;

  @Prop({ type: String, default: null, select: false })
  passwordHash!: string | null;

  @Prop({
    required: true,
    type: String,
    trim: true,
    minlength: 1,
    maxlength: 100,
  })
  displayName!: string;

  @Prop({ required: true, type: [String], enum: ROLES })
  roles!: AuthRole[];

  @Prop({ required: true, type: [String], enum: PERMISSIONS, default: [] })
  permissions!: Permission[];

  @Prop({
    required: true,
    type: String,
    enum: USER_STATUSES,
    default: "ACTIVE",
  })
  status!: UserStatus;

  @Prop({ required: true, type: Number, min: 1, default: 1 })
  rolesVersion!: number;

  @Prop({ type: Date, default: null })
  onboardingCompletedAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index(
  { normalizedEmail: 1 },
  { unique: true, name: "user_email_unique" },
);
