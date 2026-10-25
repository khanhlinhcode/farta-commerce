import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

import {
  RAG_LOCALES,
  RAG_RECORD_STATUSES,
  RAG_SOURCE_TYPES,
  type RagLocale,
  type RagRecordStatus,
  type RagSourceType,
} from "../rag.constants";
import type { RagMetadata } from "./rag-metadata.schema";
import { RagMetadataSchema } from "./rag-metadata.schema";

@Schema({
  collection: "rag_knowledge_chunks",
  strict: "throw",
  timestamps: true,
})
export class KnowledgeChunk {
  @Prop({ required: true, type: String, maxlength: 160 })
  tenantId!: string;

  @Prop({ required: true, type: String, maxlength: 80 })
  documentId!: string;

  @Prop({ required: true, type: String, maxlength: 80 })
  chunkId!: string;

  @Prop({ required: true, type: String, enum: RAG_SOURCE_TYPES })
  sourceType!: RagSourceType;

  @Prop({ required: true, type: String, maxlength: 160 })
  sourceId!: string;

  @Prop({ required: true, type: String, enum: RAG_LOCALES })
  locale!: RagLocale;

  @Prop({ required: true, type: String, enum: ["PUBLIC"] })
  audience!: "PUBLIC";

  @Prop({ required: true, type: String, maxlength: 200 })
  title!: string;

  @Prop({ required: true, type: String, maxlength: 500 })
  canonicalPath!: string;

  @Prop({ required: true, type: String, maxlength: 4_000 })
  content!: string;

  @Prop({ required: true, type: String, minlength: 64, maxlength: 64 })
  contentHash!: string;

  @Prop({ required: true, type: Number, min: 0, max: 10_000 })
  ordinal!: number;

  @Prop({ required: true, type: Number, min: 1, max: 10_000 })
  tokenEstimate!: number;

  @Prop({ required: true, type: String, maxlength: 160 })
  sourceVersion!: string;

  @Prop({ required: true, type: Date })
  sourceUpdatedAt!: Date;

  @Prop({ type: Date, default: null })
  publishedAt!: Date | null;

  @Prop({ required: true, type: Number, min: 1, max: 10 })
  schemaVersion!: number;

  @Prop({ required: true, type: String, maxlength: 80 })
  indexVersion!: string;

  @Prop({ required: true, type: String, enum: RAG_RECORD_STATUSES })
  status!: RagRecordStatus;

  @Prop({ required: true, type: RagMetadataSchema })
  metadata!: RagMetadata;

  @Prop({ required: true, type: String, maxlength: 160 })
  embeddingModel!: string;

  @Prop({ required: true, type: String, maxlength: 80 })
  embeddingVersion!: string;

  @Prop({ required: true, type: Number, min: 1, max: 8_192 })
  embeddingDimensions!: number;

  @Prop({ required: true, type: [Number] })
  embedding!: number[];

  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type KnowledgeChunkDocument = HydratedDocument<KnowledgeChunk>;
export const KnowledgeChunkSchema =
  SchemaFactory.createForClass(KnowledgeChunk);
KnowledgeChunkSchema.index(
  { tenantId: 1, chunkId: 1 },
  { unique: true, name: "rag_chunk_unique" },
);
KnowledgeChunkSchema.index(
  { tenantId: 1, documentId: 1, sourceVersion: 1, ordinal: 1 },
  { unique: true, name: "rag_chunk_document_version_ordinal_unique" },
);
KnowledgeChunkSchema.index(
  {
    tenantId: 1,
    status: 1,
    audience: 1,
    locale: 1,
    sourceType: 1,
    indexVersion: 1,
  },
  { name: "rag_chunk_public_filter" },
);
