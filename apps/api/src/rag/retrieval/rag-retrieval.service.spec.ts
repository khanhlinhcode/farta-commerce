import { describe, expect, it, vi } from "vitest";

import { DeterministicEmbeddingProvider } from "../embedding/deterministic-embedding.provider";
import { StagingNgramEmbeddingProvider } from "../embedding/staging-ngram-embedding.provider";
import { RAG_INDEX_VERSION } from "../rag.constants";
import type { RagCandidateSource } from "./rag-candidate.source";
import { RagRetrievalService } from "./rag-retrieval.service";
import type { RagRetrievalCandidate } from "./rag-retrieval.types";

async function candidate(
  overrides: Partial<RagRetrievalCandidate> = {},
): Promise<RagRetrievalCandidate> {
  const provider = new DeterministicEmbeddingProvider();
  const content =
    overrides.content ?? "FARTA Essential Tee. Áo cotton phom rộng màu đen.";
  const [embedding] = await provider.embed([content]);
  return {
    documentId: "ragdoc_document",
    chunkId: "ragchunk_chunk",
    sourceType: "PRODUCT",
    sourceId: "farta-essential-tee",
    locale: "vi",
    title: "FARTA Essential Tee",
    canonicalPath: "/product/farta-essential-tee",
    content,
    ordinal: 0,
    sourceVersion: "rag-product-v1:version",
    sourceUpdatedAt: new Date("2026-10-25T00:00:00.000Z"),
    metadata: {
      productSlug: "farta-essential-tee",
      categoryIds: ["category-1"],
      tags: ["cotton"],
    },
    indexVersion: RAG_INDEX_VERSION,
    embeddingModel: provider.identity.model,
    embeddingVersion: provider.identity.version,
    embeddingDimensions: provider.identity.dimensions,
    embedding: embedding ?? [],
    ...overrides,
  };
}

describe("RagRetrievalService", () => {
  it("returns deterministic public citations for Vietnamese lexical matches", async () => {
    const listCandidates = vi.fn().mockResolvedValue([await candidate()]);
    const service = new RagRetrievalService(
      new DeterministicEmbeddingProvider(),
      { listCandidates } as RagCandidateSource,
      "test",
    );

    const result = await service.retrieve({
      tenantId: "farta",
      query: "áo cotton đen",
      locale: "vi",
      sourceTypes: ["PRODUCT"],
      categoryIds: ["category-1"],
      tags: ["Cotton"],
      limit: 3,
    });

    expect(result.mode).toBe("LOCAL_DETERMINISTIC_HYBRID");
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]?.citation).toEqual(
      expect.objectContaining({
        citationId: "citation:ragchunk_chunk",
        sourceId: "farta-essential-tee",
        canonicalPath: "/product/farta-essential-tee",
        contentTrust: "UNTRUSTED_PUBLIC_CONTENT",
      }),
    );
    expect(result.hits[0]?.lexicalScore).toBeGreaterThan(0);
    expect(listCandidates).toHaveBeenCalledWith({
      tenantId: "farta",
      locale: "vi",
      sourceTypes: ["PRODUCT"],
      indexVersion: RAG_INDEX_VERSION,
      embeddingModel: "farta-deterministic-test-embedding",
      embeddingVersion: "v1",
      embeddingDimensions: 32,
      categoryIds: ["category-1"],
      tags: ["cotton"],
      maxCandidates: 200,
    });
  });

  it("never creates a citation from vector proximity without lexical evidence", async () => {
    const unrelated = await candidate({
      title: "Chính sách giao hàng",
      content: "Thời gian giao hàng tiêu chuẩn từ ba đến năm ngày.",
    });
    const service = new RagRetrievalService(
      new DeterministicEmbeddingProvider(),
      {
        listCandidates: vi.fn().mockResolvedValue([unrelated]),
      } as RagCandidateSource,
      "development",
    );

    const result = await service.retrieve({
      tenantId: "farta",
      query: "áo cotton đen",
      locale: "vi",
      sourceTypes: ["PRODUCT", "SHIPPING_POLICY"],
    });
    expect(result.hits).toEqual([]);
  });

  it("fails closed in deployed environments while the embedding is test-only", async () => {
    const listCandidates = vi.fn();
    const service = new RagRetrievalService(
      new DeterministicEmbeddingProvider(),
      { listCandidates } as RagCandidateSource,
      "staging",
    );
    await expect(
      service.retrieve({
        tenantId: "farta",
        query: "áo cotton",
        locale: "vi",
        sourceTypes: ["PRODUCT"],
      }),
    ).rejects.toThrow("RAG_RETRIEVAL_PROVIDER_NOT_PRODUCTION_SAFE");
    expect(listCandidates).not.toHaveBeenCalled();
  });

  it("allows the bounded n-gram profile in staging", async () => {
    const provider = new StagingNgramEmbeddingProvider();
    const content = "FARTA Essential Tee. Áo cotton phom rộng màu đen.";
    const [embedding] = await provider.embed([content]);
    const listCandidates = vi.fn().mockResolvedValue([
      await candidate({
        content,
        embeddingModel: provider.identity.model,
        embeddingVersion: provider.identity.version,
        embeddingDimensions: provider.identity.dimensions,
        embedding: embedding ?? [],
      }),
    ]);
    const service = new RagRetrievalService(
      provider,
      { listCandidates } as RagCandidateSource,
      "staging",
    );

    const result = await service.retrieve({
      tenantId: "farta",
      query: "ao cotton den",
      locale: "vi",
      sourceTypes: ["PRODUCT"],
    });

    expect(result.mode).toBe("STAGING_NGRAM_HYBRID");
    expect(result.hits).toHaveLength(1);
    expect(listCandidates).toHaveBeenCalledWith(
      expect.objectContaining({
        indexVersion: RAG_INDEX_VERSION,
        embeddingModel: provider.identity.model,
        embeddingVersion: provider.identity.version,
        embeddingDimensions: provider.identity.dimensions,
      }),
    );
  });

  it("rejects every retrieval profile in production", async () => {
    const listCandidates = vi.fn();
    const service = new RagRetrievalService(
      new StagingNgramEmbeddingProvider(),
      { listCandidates } as RagCandidateSource,
      "production",
    );

    await expect(
      service.retrieve({
        tenantId: "farta",
        query: "ao cotton den",
        locale: "vi",
        sourceTypes: ["PRODUCT"],
      }),
    ).rejects.toThrow("RAG_RETRIEVAL_ENVIRONMENT_NOT_APPROVED");
    expect(listCandidates).not.toHaveBeenCalled();
  });

  it.each([
    { query: "x", sourceTypes: ["PRODUCT"] as const },
    { query: "áo cotton", sourceTypes: [] as const },
    { query: "áo cotton", sourceTypes: ["PRODUCT"] as const, limit: 9 },
  ])("rejects an invalid bounded request", async (request) => {
    const service = new RagRetrievalService(
      new DeterministicEmbeddingProvider(),
      { listCandidates: vi.fn() } as RagCandidateSource,
      "test",
    );
    await expect(
      service.retrieve({
        tenantId: "farta",
        locale: "vi",
        ...request,
      }),
    ).rejects.toThrow(/^RAG_/);
  });
});
