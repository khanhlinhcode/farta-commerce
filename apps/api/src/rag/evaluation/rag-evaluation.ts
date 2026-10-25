import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";

import { DeterministicEmbeddingProvider } from "../embedding/deterministic-embedding.provider";
import type { RagCandidateSource } from "../retrieval/rag-candidate.source";
import { RagRetrievalService } from "../retrieval/rag-retrieval.service";
import type {
  RagRetrievalCandidate,
  RagRetrievalCandidateQuery,
} from "../retrieval/rag-retrieval.types";
import {
  RAG_EVALUATION_CASES,
  RAG_EVALUATION_CORPUS,
  RAG_EVALUATION_DATASET_VERSION,
  type RagEvaluationCase,
  type RagEvaluationDocument,
} from "./rag-evaluation.dataset";

const EVALUATION_K = 3;
const SOURCE_VERSION = `${RAG_EVALUATION_DATASET_VERSION}:synthetic`;
const SOURCE_UPDATED_AT = new Date("2026-10-25T00:00:00.000Z");

export const RAG_EVALUATION_THRESHOLDS = {
  meanRecallAt3: 1,
  meanPrecisionAt3: 1,
  meanReciprocalRank: 1,
  meanNdcgAt3: 1,
  metadataFilterAccuracy: 1,
  emptyResultAccuracy: 1,
  citationCorrectness: 1,
  providerCalls: 0,
} as const;

type EvaluationFailure = {
  caseId: string;
  expectedSourceIds: readonly string[];
  actualSourceIds: readonly string[];
};

export type RagEvaluationReport = {
  datasetVersion: string;
  cases: number;
  rankingCases: number;
  emptyResultCases: number;
  filterCases: number;
  providerCalls: 0;
  meanRecallAt3: number;
  meanPrecisionAt3: number;
  meanReciprocalRank: number;
  meanNdcgAt3: number;
  metadataFilterAccuracy: number;
  emptyResultAccuracy: number;
  citationCorrectness: number;
  latencyP50Ms: number;
  latencyP95Ms: number;
  thresholds: typeof RAG_EVALUATION_THRESHOLDS;
  failures: EvaluationFailure[];
  passed: boolean;
};

class EvaluationCandidateSource implements RagCandidateSource {
  constructor(
    private readonly candidates: readonly (RagRetrievalCandidate & {
      tenantId: string;
    })[],
  ) {}

  async listCandidates(
    query: RagRetrievalCandidateQuery,
  ): Promise<RagRetrievalCandidate[]> {
    return this.candidates
      .filter(
        (candidate) =>
          candidate.tenantId === query.tenantId &&
          candidate.locale === query.locale &&
          query.sourceTypes.includes(candidate.sourceType) &&
          (!query.categoryIds?.length ||
            candidate.metadata.categoryIds.some((categoryId) =>
              query.categoryIds?.includes(categoryId),
            )) &&
          (!query.tags?.length ||
            candidate.metadata.tags.some((tag) => query.tags?.includes(tag))),
      )
      .sort(
        (left, right) =>
          right.sourceUpdatedAt.getTime() - left.sourceUpdatedAt.getTime() ||
          left.chunkId.localeCompare(right.chunkId),
      )
      .slice(0, query.maxCandidates);
  }
}

function stableId(prefix: "ragdoc" | "ragchunk", value: string): string {
  return `${prefix}_${createHash("sha256").update(value).digest("hex")}`;
}

async function buildCandidates(
  documents: readonly RagEvaluationDocument[],
  embeddings: DeterministicEmbeddingProvider,
): Promise<readonly (RagRetrievalCandidate & { tenantId: string })[]> {
  const vectors = await embeddings.embed(
    documents.map((document) => document.content),
  );
  return documents.map((document, index) => ({
    tenantId: document.tenantId,
    documentId: stableId("ragdoc", `${document.tenantId}:${document.sourceId}`),
    chunkId: stableId(
      "ragchunk",
      `${document.tenantId}:${document.sourceId}:0`,
    ),
    sourceType: document.sourceType,
    sourceId: document.sourceId,
    locale: document.locale,
    title: document.title,
    canonicalPath: document.canonicalPath,
    content: document.content,
    ordinal: 0,
    sourceVersion: SOURCE_VERSION,
    sourceUpdatedAt: SOURCE_UPDATED_AT,
    metadata: {
      productSlug: document.sourceType === "PRODUCT" ? document.sourceId : null,
      categoryIds: [...document.categoryIds],
      tags: [...document.tags],
    },
    embeddingDimensions: embeddings.identity.dimensions,
    embedding: vectors[index] ?? [],
  }));
}

function validateDataset(
  documents: readonly RagEvaluationDocument[],
  cases: readonly RagEvaluationCase[],
): void {
  const caseIds = cases.map((testCase) => testCase.caseId);
  if (cases.length < 10 || caseIds.length !== new Set(caseIds).size) {
    throw new Error("RAG_EVALUATION_DATASET_INVALID");
  }
  const documentsBySource = new Map(
    documents.map((document) => [document.sourceId, document]),
  );
  for (const testCase of cases) {
    if (!/^FARTA-RAG-V1-[0-9]{3}$/.test(testCase.caseId)) {
      throw new Error("RAG_EVALUATION_CASE_ID_INVALID");
    }
    for (const sourceId of testCase.relevantSourceIds) {
      const document = documentsBySource.get(sourceId);
      if (
        !document ||
        document.tenantId !== testCase.tenantId ||
        document.locale !== testCase.locale ||
        !testCase.sourceTypes.includes(document.sourceType)
      ) {
        throw new Error("RAG_EVALUATION_RELEVANCE_INVALID");
      }
    }
  }
}

function round(value: number): number {
  return Number(value.toFixed(6));
}

function mean(values: readonly number[]): number {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value) => new Set(right).has(value))
  );
}

function ndcgAtK(
  actual: readonly string[],
  relevant: ReadonlySet<string>,
): number {
  const dcg = actual.slice(0, EVALUATION_K).reduce((score, sourceId, index) => {
    return score + (relevant.has(sourceId) ? 1 / Math.log2(index + 2) : 0);
  }, 0);
  const idealCount = Math.min(relevant.size, EVALUATION_K);
  const ideal = Array.from({ length: idealCount }).reduce<number>(
    (score, _, index) => score + 1 / Math.log2(index + 2),
    0,
  );
  return ideal === 0 ? 0 : dcg / ideal;
}

export async function evaluateLocalRag(
  documents: readonly RagEvaluationDocument[] = RAG_EVALUATION_CORPUS,
  cases: readonly RagEvaluationCase[] = RAG_EVALUATION_CASES,
): Promise<RagEvaluationReport> {
  validateDataset(documents, cases);
  const embeddingProvider = new DeterministicEmbeddingProvider();
  const candidates = await buildCandidates(documents, embeddingProvider);
  const retrieval = new RagRetrievalService(
    embeddingProvider,
    new EvaluationCandidateSource(candidates),
    "test",
  );
  const documentsBySource = new Map(
    documents.map((document) => [document.sourceId, document]),
  );
  const recalls: number[] = [];
  const precisions: number[] = [];
  const reciprocalRanks: number[] = [];
  const ndcgs: number[] = [];
  const filterResults: boolean[] = [];
  const emptyResults: boolean[] = [];
  const citationResults: boolean[] = [];
  const latencies: number[] = [];
  const failures: EvaluationFailure[] = [];

  for (const testCase of cases) {
    const started = performance.now();
    const result = await retrieval.retrieve({
      tenantId: testCase.tenantId,
      query: testCase.query,
      locale: testCase.locale,
      sourceTypes: testCase.sourceTypes,
      ...(testCase.categoryIds ? { categoryIds: testCase.categoryIds } : {}),
      ...(testCase.tags ? { tags: testCase.tags } : {}),
      limit: EVALUATION_K,
    });
    latencies.push(performance.now() - started);
    const actual = result.hits.map((hit) => hit.citation.sourceId);
    const relevant = new Set(testCase.relevantSourceIds);
    if (relevant.size === 0) {
      emptyResults.push(actual.length === 0);
    } else {
      const relevantReturned = actual.filter((sourceId) =>
        relevant.has(sourceId),
      ).length;
      recalls.push(relevantReturned / relevant.size);
      precisions.push(
        actual.length === 0 ? 0 : relevantReturned / actual.length,
      );
      const firstRelevant = actual.findIndex((sourceId) =>
        relevant.has(sourceId),
      );
      reciprocalRanks.push(firstRelevant === -1 ? 0 : 1 / (firstRelevant + 1));
      ndcgs.push(ndcgAtK(actual, relevant));
    }
    if (testCase.validatesFilter) {
      filterResults.push(sameSet(actual, testCase.relevantSourceIds));
    }
    for (const hit of result.hits) {
      const document = documentsBySource.get(hit.citation.sourceId);
      citationResults.push(
        Boolean(
          document &&
          document.tenantId === testCase.tenantId &&
          document.locale === testCase.locale &&
          hit.citation.citationId === `citation:${hit.citation.chunkId}` &&
          hit.citation.canonicalPath === document.canonicalPath &&
          hit.citation.sourceVersion === SOURCE_VERSION &&
          hit.citation.contentTrust === "UNTRUSTED_PUBLIC_CONTENT",
        ),
      );
    }
    if (!sameSet(actual, testCase.relevantSourceIds)) {
      failures.push({
        caseId: testCase.caseId,
        expectedSourceIds: testCase.relevantSourceIds,
        actualSourceIds: actual,
      });
    }
  }

  const sortedLatencies = [...latencies].sort((left, right) => left - right);
  const metricValues = {
    meanRecallAt3: round(mean(recalls)),
    meanPrecisionAt3: round(mean(precisions)),
    meanReciprocalRank: round(mean(reciprocalRanks)),
    meanNdcgAt3: round(mean(ndcgs)),
    metadataFilterAccuracy: round(mean(filterResults.map(Number))),
    emptyResultAccuracy: round(mean(emptyResults.map(Number))),
    citationCorrectness: round(mean(citationResults.map(Number))),
  };
  const passed =
    failures.length === 0 &&
    metricValues.meanRecallAt3 >= RAG_EVALUATION_THRESHOLDS.meanRecallAt3 &&
    metricValues.meanPrecisionAt3 >=
      RAG_EVALUATION_THRESHOLDS.meanPrecisionAt3 &&
    metricValues.meanReciprocalRank >=
      RAG_EVALUATION_THRESHOLDS.meanReciprocalRank &&
    metricValues.meanNdcgAt3 >= RAG_EVALUATION_THRESHOLDS.meanNdcgAt3 &&
    metricValues.metadataFilterAccuracy >=
      RAG_EVALUATION_THRESHOLDS.metadataFilterAccuracy &&
    metricValues.emptyResultAccuracy >=
      RAG_EVALUATION_THRESHOLDS.emptyResultAccuracy &&
    metricValues.citationCorrectness >=
      RAG_EVALUATION_THRESHOLDS.citationCorrectness;

  return {
    datasetVersion: RAG_EVALUATION_DATASET_VERSION,
    cases: cases.length,
    rankingCases: recalls.length,
    emptyResultCases: emptyResults.length,
    filterCases: filterResults.length,
    providerCalls: 0,
    ...metricValues,
    latencyP50Ms: round(
      sortedLatencies[Math.floor(sortedLatencies.length / 2)] ?? 0,
    ),
    latencyP95Ms: round(
      sortedLatencies[
        Math.max(0, Math.ceil(sortedLatencies.length * 0.95) - 1)
      ] ?? 0,
    ),
    thresholds: RAG_EVALUATION_THRESHOLDS,
    failures,
    passed,
  };
}
