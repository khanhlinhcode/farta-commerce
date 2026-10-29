import { describe, expect, it } from "vitest";

import { StagingNgramEmbeddingProvider } from "../rag/embedding/staging-ngram-embedding.provider";
import { DeterministicRagChunker } from "../rag/ingestion/deterministic-chunker";
import { RagDocumentProjector } from "../rag/ingestion/rag-document-projector";
import { RagPublicContentPolicy } from "../rag/ingestion/public-content-policy";
import type { RagCandidateSource } from "../rag/retrieval/rag-candidate.source";
import { RagRetrievalService } from "../rag/retrieval/rag-retrieval.service";
import type { RagRetrievalCandidate } from "../rag/retrieval/rag-retrieval.types";
import { stagingSupportRagSources } from "../rag/sources/staging-support-rag-source";
import { assertStagingSupportBoundary } from "./rebuild-staging-support-index";

const base = {
  APP_ENV: "staging",
  NF_PROJECT_ID: "farta-commerce-staging",
  NF_OBJECT_ID: "farta-api",
  NF_DEPLOYMENT_SHA: "a".repeat(40),
  AI_RAG_ENABLED: "true",
  AI_RAG_STAGING_APPROVED: "true",
  AI_RAG_RETRIEVAL_PROFILE: "staging-ngram-v1",
  RAG_STAGING_SUPPORT_MODE: "preview",
  ALLOW_STAGING_SUPPORT_RAG_REBUILD: "PREVIEW_STAGING_RAG_SUPPORT_V1",
} satisfies NodeJS.ProcessEnv;

describe("staging support RAG boundary", () => {
  it("admits only the bound staging API workload", () => {
    expect(assertStagingSupportBoundary(base)).toEqual({
      mode: "preview",
      deploymentSha: "a".repeat(40),
    });
    for (const change of [
      { APP_ENV: "production" },
      { NF_OBJECT_ID: "farta-reservation-expiry" },
      { AI_RAG_ENABLED: "false" },
      { AI_RAG_STAGING_APPROVED: "false" },
      { AI_RAG_RETRIEVAL_PROFILE: "local-only" },
    ]) {
      expect(() =>
        assertStagingSupportBoundary({ ...base, ...change }),
      ).toThrow();
    }
  });

  it("requires the exact preview binding before any apply", () => {
    const apply = {
      ...base,
      RAG_STAGING_SUPPORT_MODE: "apply",
      ALLOW_STAGING_SUPPORT_RAG_REBUILD: "APPLY_STAGING_RAG_SUPPORT_V1",
      RAG_STAGING_SUPPORT_EXPECTED_COUNT: "4",
      RAG_STAGING_SUPPORT_EXPECTED_SOURCE_FINGERPRINT: "b".repeat(64),
      RAG_STAGING_SUPPORT_EXPECTED_DATABASE_FINGERPRINT: "c".repeat(64),
      RAG_STAGING_SUPPORT_EXPECTED_DEPLOYMENT_SHA: "a".repeat(40),
      RAG_STAGING_SUPPORT_EXPECTED_INDEX_VERSION: "rag-staging-ngram-v2",
    };
    expect(assertStagingSupportBoundary(apply).mode).toBe("apply");
    expect(() =>
      assertStagingSupportBoundary({
        ...apply,
        RAG_STAGING_SUPPORT_EXPECTED_DATABASE_FINGERPRINT: undefined,
      }),
    ).toThrow();
  });
});

describe("approved staging support source set", () => {
  it("projects four distinct public-safe topics with resolvable paths", () => {
    const sources = stagingSupportRagSources();
    expect(sources.map((source) => source.sourceType).sort()).toEqual([
      "FAQ",
      "RETURN_POLICY",
      "SHIPPING_POLICY",
      "SIZE_GUIDE",
    ]);
    expect(new Set(sources.map((source) => source.canonicalPath)).size).toBe(4);
    const policy = new RagPublicContentPolicy();
    for (const source of sources) {
      expect(source.canonicalPath).toMatch(/^\/help\//);
      expect(source.sourceVersion).toMatch(
        /^rag-staging-support-v1:[a-f0-9]{64}$/,
      );
      expect(source.publishedAt).toEqual(source.sourceUpdatedAt);
      expect(() => policy.validateAndNormalize(source)).not.toThrow();
    }
  });

  it("retrieves a matching citation for each topic with the staging profile", async () => {
    const embeddings = new StagingNgramEmbeddingProvider();
    const projector = new RagDocumentProjector(
      embeddings,
      new DeterministicRagChunker(1_200),
    );
    const sources = stagingSupportRagSources();
    const projected = await Promise.all(
      sources.map((source) => projector.project(source)),
    );
    const candidates: RagRetrievalCandidate[] = projected.flatMap(
      ({ chunks }) =>
        chunks.map((chunk) => ({
          documentId: chunk.documentId,
          chunkId: chunk.chunkId,
          sourceType: chunk.sourceType,
          sourceId: chunk.sourceId,
          locale: chunk.locale,
          title: chunk.title,
          canonicalPath: chunk.canonicalPath,
          content: chunk.content,
          ordinal: chunk.ordinal,
          sourceVersion: chunk.sourceVersion,
          sourceUpdatedAt: chunk.sourceUpdatedAt,
          metadata: chunk.metadata,
          indexVersion: chunk.indexVersion,
          embeddingModel: chunk.embeddingModel,
          embeddingVersion: chunk.embeddingVersion,
          embeddingDimensions: chunk.embeddingDimensions,
          embedding: chunk.embedding,
        })),
    );
    const retrieval = new RagRetrievalService(
      embeddings,
      {
        listCandidates: async (input) =>
          candidates.filter(
            (candidate) =>
              candidate.locale === input.locale &&
              input.sourceTypes.includes(candidate.sourceType),
          ),
      } as RagCandidateSource,
      "staging",
    );
    const queries = [
      "giao hàng tiêu chuẩn phí vận chuyển",
      "đổi trả hoàn tiền",
      "bảng số đo size",
      "câu hỏi thường gặp phí giao hàng",
    ];
    for (const [index, source] of sources.entries()) {
      const result = await retrieval.retrieve({
        tenantId: "farta",
        locale: "vi",
        sourceTypes: [source.sourceType],
        query: queries[index]!,
      });
      expect(result.hits.map((hit) => hit.citation.sourceId)).toContain(
        source.sourceId,
      );
    }
  });
});
