import type { Model } from "mongoose";
import { describe, expect, it, vi } from "vitest";

import {
  RAG_INDEX_VERSION,
  RAG_STAGING_NGRAM_EMBEDDING_DIMENSIONS,
  RAG_STAGING_NGRAM_EMBEDDING_MODEL,
  RAG_STAGING_NGRAM_EMBEDDING_VERSION,
} from "../rag.constants";
import type { KnowledgeChunkDocument } from "../schemas/knowledge-chunk.schema";
import { MongoRagCandidateSource } from "./mongo-rag-candidate.source";

describe("MongoRagCandidateSource", () => {
  it("filters candidates by the complete index and embedding identity", async () => {
    const exec = vi.fn().mockResolvedValue([]);
    const lean = vi.fn(() => ({ exec }));
    const select = vi.fn(() => ({ lean }));
    const limit = vi.fn(() => ({ select }));
    const sort = vi.fn(() => ({ limit }));
    const find = vi.fn(() => ({ sort }));
    const source = new MongoRagCandidateSource({
      find,
    } as unknown as Model<KnowledgeChunkDocument>);

    await source.listCandidates({
      tenantId: "farta",
      locale: "vi",
      sourceTypes: ["PRODUCT"],
      indexVersion: RAG_INDEX_VERSION,
      embeddingModel: RAG_STAGING_NGRAM_EMBEDDING_MODEL,
      embeddingVersion: RAG_STAGING_NGRAM_EMBEDDING_VERSION,
      embeddingDimensions: RAG_STAGING_NGRAM_EMBEDDING_DIMENSIONS,
      maxCandidates: 200,
    });

    expect(find).toHaveBeenCalledWith({
      tenantId: "farta",
      audience: "PUBLIC",
      status: "ACTIVE",
      locale: "vi",
      sourceType: { $in: ["PRODUCT"] },
      indexVersion: RAG_INDEX_VERSION,
      embeddingModel: RAG_STAGING_NGRAM_EMBEDDING_MODEL,
      embeddingVersion: RAG_STAGING_NGRAM_EMBEDDING_VERSION,
      embeddingDimensions: RAG_STAGING_NGRAM_EMBEDDING_DIMENSIONS,
    });
  });
});
