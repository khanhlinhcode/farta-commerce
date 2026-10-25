import type { RagLocale, RagSourceType } from "../rag.constants";

export type RagRetrievalRequest = {
  tenantId: string;
  query: string;
  locale: RagLocale;
  sourceTypes: readonly RagSourceType[];
  categoryIds?: readonly string[];
  tags?: readonly string[];
  limit?: number;
};

export type RagRetrievalCandidateQuery = Omit<
  RagRetrievalRequest,
  "query" | "limit"
> & {
  maxCandidates: number;
};

export type RagRetrievalCandidate = {
  documentId: string;
  chunkId: string;
  sourceType: RagSourceType;
  sourceId: string;
  locale: RagLocale;
  title: string;
  canonicalPath: string;
  content: string;
  ordinal: number;
  sourceVersion: string;
  sourceUpdatedAt: Date;
  metadata: {
    productSlug: string | null;
    categoryIds: string[];
    tags: string[];
  };
  embeddingDimensions: number;
  embedding: number[];
};

export type RagCitation = {
  citationId: string;
  sourceType: RagSourceType;
  sourceId: string;
  title: string;
  canonicalPath: string;
  chunkId: string;
  chunkOrdinal: number;
  excerpt: string;
  sourceVersion: string;
  sourceUpdatedAt: string;
  contentTrust: "UNTRUSTED_PUBLIC_CONTENT";
};

export type RagRetrievalHit = {
  citation: RagCitation;
  score: number;
  lexicalScore: number;
  vectorScore: number;
};

export type RagRetrievalResult = {
  mode: "LOCAL_DETERMINISTIC_HYBRID";
  query: string;
  hits: RagRetrievalHit[];
};
