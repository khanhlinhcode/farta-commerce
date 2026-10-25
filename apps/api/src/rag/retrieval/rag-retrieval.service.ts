import { Inject, Injectable } from "@nestjs/common";

import type { AppEnvironment } from "../../config/environment";
import {
  RAG_EMBEDDING_PROVIDER,
  type RagEmbeddingProvider,
} from "../embedding/embedding-provider";
import { RAG_INDEX_VERSION, RAG_SOURCE_TYPES } from "../rag.constants";
import {
  RAG_CANDIDATE_SOURCE,
  type RagCandidateSource,
} from "./rag-candidate.source";
import type {
  RagRetrievalCandidate,
  RagRetrievalHit,
  RagRetrievalRequest,
  RagRetrievalResult,
} from "./rag-retrieval.types";

export const RAG_RUNTIME_ENVIRONMENT = Symbol("RAG_RUNTIME_ENVIRONMENT");
const MAX_CANDIDATES = 200;
const MAX_RESULTS = 8;
const MIN_LEXICAL_SCORE = 0.45;

@Injectable()
export class RagRetrievalService {
  constructor(
    @Inject(RAG_EMBEDDING_PROVIDER)
    private readonly embeddings: RagEmbeddingProvider,
    @Inject(RAG_CANDIDATE_SOURCE)
    private readonly candidates: RagCandidateSource,
    @Inject(RAG_RUNTIME_ENVIRONMENT)
    private readonly environment: AppEnvironment,
  ) {}

  async retrieve(input: RagRetrievalRequest): Promise<RagRetrievalResult> {
    this.assertRuntimeBoundary();
    const request = this.normalizeRequest(input);
    const [queryEmbedding] = await this.embeddings.embed([request.query]);
    if (!queryEmbedding) throw new Error("RAG_QUERY_EMBEDDING_MISSING");
    const candidates = await this.candidates.listCandidates({
      tenantId: request.tenantId,
      locale: request.locale,
      sourceTypes: request.sourceTypes,
      indexVersion: RAG_INDEX_VERSION,
      embeddingModel: this.embeddings.identity.model,
      embeddingVersion: this.embeddings.identity.version,
      embeddingDimensions: this.embeddings.identity.dimensions,
      ...(request.categoryIds ? { categoryIds: request.categoryIds } : {}),
      ...(request.tags ? { tags: request.tags } : {}),
      maxCandidates: MAX_CANDIDATES,
    });
    const hits = candidates
      .map((candidate) => this.rank(request.query, queryEmbedding, candidate))
      .filter((hit): hit is RagRetrievalHit => hit !== null)
      .sort(
        (left, right) =>
          right.score - left.score ||
          right.lexicalScore - left.lexicalScore ||
          right.citation.sourceUpdatedAt.localeCompare(
            left.citation.sourceUpdatedAt,
          ) ||
          left.citation.chunkId.localeCompare(right.citation.chunkId),
      )
      .slice(0, request.limit);
    return {
      mode:
        this.embeddings.identity.runtimeScope === "STAGING_APPROVED"
          ? "STAGING_NGRAM_HYBRID"
          : "LOCAL_DETERMINISTIC_HYBRID",
      query: request.query,
      hits,
    };
  }

  private assertRuntimeBoundary(): void {
    if (this.environment === "production") {
      throw new Error("RAG_RETRIEVAL_ENVIRONMENT_NOT_APPROVED");
    }
    if (
      this.embeddings.identity.runtimeScope === "LOCAL_ONLY" &&
      this.environment !== "development" &&
      this.environment !== "test"
    ) {
      throw new Error("RAG_RETRIEVAL_PROVIDER_NOT_PRODUCTION_SAFE");
    }
  }

  private normalizeRequest(
    input: RagRetrievalRequest,
  ): RagRetrievalRequest & { limit: number } {
    const query = input.query.normalize("NFKC").replace(/\s+/g, " ").trim();
    if (query.length < 2 || query.length > 300) {
      throw new Error("RAG_QUERY_INVALID");
    }
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/.test(input.tenantId)) {
      throw new Error("RAG_TENANT_INVALID");
    }
    const sourceTypes = [...new Set(input.sourceTypes)];
    if (
      sourceTypes.length === 0 ||
      sourceTypes.some((type) => !RAG_SOURCE_TYPES.includes(type))
    ) {
      throw new Error("RAG_SOURCE_FILTER_INVALID");
    }
    const limit = input.limit ?? 5;
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_RESULTS) {
      throw new Error("RAG_LIMIT_INVALID");
    }
    const categoryIds = this.normalizeFilters(input.categoryIds);
    const tags = this.normalizeFilters(input.tags, true);
    return {
      ...input,
      query,
      sourceTypes,
      ...(categoryIds ? { categoryIds } : {}),
      ...(tags ? { tags } : {}),
      limit,
    };
  }

  private normalizeFilters(
    values: readonly string[] | undefined,
    lowercase = false,
  ): string[] | undefined {
    if (!values) return undefined;
    if (values.length > 20) throw new Error("RAG_FILTER_INVALID");
    const normalized = [
      ...new Set(
        values.map((value) => {
          const clean = value.normalize("NFKC").trim();
          if (!clean || clean.length > 120) {
            throw new Error("RAG_FILTER_INVALID");
          }
          return lowercase ? clean.toLocaleLowerCase("vi") : clean;
        }),
      ),
    ].sort();
    return normalized.length ? normalized : undefined;
  }

  private rank(
    query: string,
    queryEmbedding: number[],
    candidate: RagRetrievalCandidate,
  ): RagRetrievalHit | null {
    const lexicalScore = this.lexicalScore(
      query,
      candidate.title,
      candidate.content,
    );
    // The deterministic local embedding is not semantically meaningful. A
    // lexical match is therefore mandatory so random vector proximity can
    // never manufacture a citation.
    if (lexicalScore < MIN_LEXICAL_SCORE) return null;
    const vectorScore = this.vectorScore(queryEmbedding, candidate);
    const score = Number((lexicalScore * 0.85 + vectorScore * 0.15).toFixed(6));
    return {
      score,
      lexicalScore,
      vectorScore,
      citation: {
        citationId: `citation:${candidate.chunkId}`,
        sourceType: candidate.sourceType,
        sourceId: candidate.sourceId,
        title: candidate.title,
        canonicalPath: candidate.canonicalPath,
        chunkId: candidate.chunkId,
        chunkOrdinal: candidate.ordinal,
        excerpt: candidate.content,
        sourceVersion: candidate.sourceVersion,
        sourceUpdatedAt: candidate.sourceUpdatedAt.toISOString(),
        contentTrust: "UNTRUSTED_PUBLIC_CONTENT",
      },
    };
  }

  private lexicalScore(query: string, title: string, content: string): number {
    const queryTokens = [...new Set(this.tokens(query))];
    if (queryTokens.length === 0) return 0;
    const titleTokens = new Set(this.tokens(title));
    const contentTokens = new Set(this.tokens(content));
    const titleMatches = queryTokens.filter((token) =>
      titleTokens.has(token),
    ).length;
    const contentMatches = queryTokens.filter((token) =>
      contentTokens.has(token),
    ).length;
    if (contentMatches === 0) return 0;
    const coverage = contentMatches / queryTokens.length;
    const titleCoverage = titleMatches / queryTokens.length;
    const normalizedQuery = this.normalizedSearchText(query);
    const phraseBonus = this.normalizedSearchText(content).includes(
      normalizedQuery,
    )
      ? 0.1
      : 0;
    return Number(
      Math.min(1, coverage * 0.75 + titleCoverage * 0.15 + phraseBonus).toFixed(
        6,
      ),
    );
  }

  private vectorScore(
    queryEmbedding: number[],
    candidate: RagRetrievalCandidate,
  ): number {
    if (
      candidate.embeddingDimensions !== queryEmbedding.length ||
      candidate.embedding.length !== queryEmbedding.length ||
      candidate.embedding.some((value) => !Number.isFinite(value))
    ) {
      return 0;
    }
    const dot = queryEmbedding.reduce(
      (sum, value, index) => sum + value * (candidate.embedding[index] ?? 0),
      0,
    );
    return Number(Math.max(0, Math.min(1, (dot + 1) / 2)).toFixed(6));
  }

  private tokens(value: string): string[] {
    return this.normalizedSearchText(value).match(/[a-z0-9]+/g) ?? [];
  }

  private normalizedSearchText(value: string): string {
    return value
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .replace(/đ/gi, "d")
      .toLocaleLowerCase("vi")
      .replace(/\s+/g, " ")
      .trim();
  }
}
