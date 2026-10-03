import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";
import { Types } from "mongoose";

import { OAUTH_PROVIDERS, type OAuthProvider } from "../oauth/oauth.types";

@Schema({
  collection: "external_identities",
  strict: "throw",
  timestamps: true,
})
export class ExternalIdentity {
  @Prop({ required: true, type: Types.ObjectId, ref: "User", index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, type: String, enum: OAUTH_PROVIDERS })
  provider!: OAuthProvider;

  @Prop({ required: true, type: String, minlength: 1, maxlength: 255 })
  providerSubject!: string;

  @Prop({ type: String, default: null, maxlength: 320 })
  providerEmailSnapshot!: string | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type ExternalIdentityDocument = HydratedDocument<ExternalIdentity>;
export const ExternalIdentitySchema =
  SchemaFactory.createForClass(ExternalIdentity);
ExternalIdentitySchema.index(
  { provider: 1, providerSubject: 1 },
  { unique: true, name: "external_identity_subject_unique" },
);
ExternalIdentitySchema.index(
  { userId: 1, provider: 1 },
  { unique: true, name: "external_identity_user_provider_unique" },
);
