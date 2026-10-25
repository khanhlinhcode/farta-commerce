export const RAG_SCHEMA_VERSION = 1 as const;
export const RAG_INDEX_VERSION = "rag-staging-ngram-v2" as const;

export const RAG_SOURCE_TYPES = [
  "PRODUCT",
  "CATEGORY",
  "SHIPPING_POLICY",
  "RETURN_POLICY",
  "SIZE_GUIDE",
  "FAQ",
] as const;
export type RagSourceType = (typeof RAG_SOURCE_TYPES)[number];

export const RAG_LOCALES = ["vi", "en"] as const;
export type RagLocale = (typeof RAG_LOCALES)[number];

export const RAG_RECORD_STATUSES = [
  "ACTIVE",
  "SUPERSEDED",
  "TOMBSTONED",
] as const;
export type RagRecordStatus = (typeof RAG_RECORD_STATUSES)[number];

export const RAG_PUBLIC_AUDIENCE = "PUBLIC" as const;
export const RAG_DETERMINISTIC_EMBEDDING_MODEL =
  "farta-deterministic-test-embedding" as const;
export const RAG_DETERMINISTIC_EMBEDDING_VERSION = "v1" as const;
export const RAG_DETERMINISTIC_EMBEDDING_DIMENSIONS = 32 as const;
export const RAG_STAGING_NGRAM_EMBEDDING_MODEL =
  "farta-staging-ngram-embedding" as const;
export const RAG_STAGING_NGRAM_EMBEDDING_VERSION = "v1" as const;
export const RAG_STAGING_NGRAM_EMBEDDING_DIMENSIONS = 256 as const;
