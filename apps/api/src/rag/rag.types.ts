import type {
  RagLocale,
  RagRecordStatus,
  RagSourceType,
} from "./rag.constants";

export type RagSourceMetadata = {
  productSlug: string | null;
  categoryIds: string[];
  tags: string[];
};

export type RagSourceDocument = {
  tenantId: string;
  sourceType: RagSourceType;
  sourceId: string;
  locale: RagLocale;
  title: string;
  canonicalPath: string;
  contentSections: string[];
  sourceVersion: string;
  sourceUpdatedAt: Date;
  publishedAt: Date | null;
  metadata: RagSourceMetadata;
};

export type RagSourceIdentity = Pick<
  RagSourceDocument,
  "tenantId" | "sourceType" | "sourceId" | "locale"
>;

export type RagEmbeddingIdentity = {
  model: string;
  version: string;
  dimensions: number;
  runtimeScope: "LOCAL_ONLY" | "STAGING_APPROVED";
};

export type RagProjectedDocument = {
  tenantId: string;
  documentId: string;
  sourceType: RagSourceType;
  sourceId: string;
  locale: RagLocale;
  audience: "PUBLIC";
  title: string;
  canonicalPath: string;
  content: string;
  contentHash: string;
  sourceVersion: string;
  sourceUpdatedAt: Date;
  publishedAt: Date | null;
  schemaVersion: number;
  indexVersion: string;
  status: RagRecordStatus;
  metadata: RagSourceMetadata;
};

export type RagProjectedChunk = {
  tenantId: string;
  documentId: string;
  chunkId: string;
  sourceType: RagSourceType;
  sourceId: string;
  locale: RagLocale;
  audience: "PUBLIC";
  title: string;
  canonicalPath: string;
  content: string;
  contentHash: string;
  ordinal: number;
  tokenEstimate: number;
  sourceVersion: string;
  sourceUpdatedAt: Date;
  publishedAt: Date | null;
  schemaVersion: number;
  indexVersion: string;
  status: RagRecordStatus;
  metadata: RagSourceMetadata;
  embeddingModel: string;
  embeddingVersion: string;
  embeddingDimensions: number;
  embedding: number[];
};

export type RagProjection = {
  document: RagProjectedDocument;
  chunks: RagProjectedChunk[];
};

export type RagWriteResult = {
  outcome: "CREATED" | "REPLACED" | "REPAIRED" | "UNCHANGED" | "STALE";
  documentId: string;
  sourceVersion: string;
  chunks: number;
};

export type RagTombstoneResult = {
  documentId: string;
  documentsChanged: number;
  chunksChanged: number;
};

export type RagSourceSet = Pick<
  RagSourceIdentity,
  "tenantId" | "sourceType" | "locale"
> & {
  activeSourceIds: string[];
};

export type RagReconcileResult = {
  documentsChanged: number;
  chunksChanged: number;
};
