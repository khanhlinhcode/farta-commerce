import { describe, expect, it } from "vitest";

import {
  RAG_EVALUATION_CASES,
  RAG_EVALUATION_CORPUS,
} from "./rag-evaluation.dataset";
import { evaluateLocalRag } from "./rag-evaluation";

describe("P2-E local RAG evaluation", () => {
  it("passes all predeclared ranking, filter, isolation and citation gates", async () => {
    const report = await evaluateLocalRag();

    expect(report).toMatchObject({
      datasetVersion: "farta-rag-eval-v1",
      cases: 12,
      rankingCases: 8,
      emptyResultCases: 4,
      filterCases: 6,
      providerCalls: 0,
      meanRecallAt3: 1,
      meanPrecisionAt3: 1,
      meanReciprocalRank: 1,
      meanNdcgAt3: 1,
      metadataFilterAccuracy: 1,
      emptyResultAccuracy: 1,
      citationCorrectness: 1,
      failures: [],
      passed: true,
    });
  });

  it("fails when the expected relevance labels do not match retrieval", async () => {
    const changedCases = RAG_EVALUATION_CASES.map((testCase) =>
      testCase.caseId === "FARTA-RAG-V1-001"
        ? { ...testCase, relevantSourceIds: ["eval-linen-midi-dress"] }
        : testCase,
    );

    const report = await evaluateLocalRag(RAG_EVALUATION_CORPUS, changedCases);
    expect(report.passed).toBe(false);
    expect(report.failures).toEqual([
      expect.objectContaining({ caseId: "FARTA-RAG-V1-001" }),
    ]);
  });

  it("rejects duplicate case IDs before running retrieval", async () => {
    await expect(
      evaluateLocalRag(RAG_EVALUATION_CORPUS, [
        ...RAG_EVALUATION_CASES,
        RAG_EVALUATION_CASES[0]!,
      ]),
    ).rejects.toThrow("RAG_EVALUATION_DATASET_INVALID");
  });
});
