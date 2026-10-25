import { describe, expect, it } from "vitest";

import {
  assertExistingIndexCompatible,
  assertNoExistingIndexCollision,
  assertStagingRagIndexEnvironment,
  resolveStagingRagIndexPlan,
} from "./create-staging-rag-indexes";

const deploymentSha = "a".repeat(40);
const boundary = {
  appEnvironment: "staging",
  aiRagEnabled: "false",
  approval: "true",
  profile: "staging-ngram-v1",
  capacityApproved: "true",
  gate: "CREATE_STAGING_RAG_INDEXES_V1",
  northflankProjectId: "farta-commerce-staging",
  northflankObjectId: "farta-api",
  deploymentSha,
  expectedDeploymentSha: deploymentSha,
  expectedDatabaseFingerprint: "b".repeat(64),
  expectedDocumentCount: "0",
  expectedChunkCount: "0",
};

describe("staging RAG index bootstrap", () => {
  it("allows only the exact approved staging boundary", () => {
    expect(() => assertStagingRagIndexEnvironment(boundary)).not.toThrow();
  });

  it.each([
    { appEnvironment: "production" },
    { aiRagEnabled: "true" },
    { approval: "false" },
    { profile: "deterministic-local" },
    { capacityApproved: "false" },
    { gate: "CREATE_DECLARED_INDEXES_V1" },
    { northflankProjectId: "production" },
    { northflankObjectId: "farta-ai" },
    { deploymentSha: "latest" },
    { expectedDeploymentSha: "c".repeat(40) },
    { expectedDatabaseFingerprint: "unknown" },
    { expectedDocumentCount: "-1" },
    { expectedChunkCount: "1.5" },
  ])("rejects an unsafe boundary override", (override) => {
    expect(() =>
      assertStagingRagIndexEnvironment({ ...boundary, ...override }),
    ).toThrow();
  });

  it("contains exactly the six allowlisted RAG indexes", () => {
    expect(
      resolveStagingRagIndexPlan()
        .map(({ options }) => options.name)
        .sort(),
    ).toEqual(
      [
        "rag_document_version_unique",
        "rag_document_active_unique",
        "rag_document_public_lookup",
        "rag_chunk_unique",
        "rag_chunk_document_version_ordinal_unique",
        "rag_chunk_public_filter",
      ].sort(),
    );
  });

  it("rejects an existing same-name index with a different definition", () => {
    const expected = resolveStagingRagIndexPlan()[0];
    expect(expected).toBeDefined();
    if (!expected) return;
    expect(() =>
      assertExistingIndexCompatible(
        {
          name: expected.options.name,
          key: expected.keys,
          unique: Boolean(expected.options.unique),
          partialFilterExpression: expected.options.partialFilterExpression,
        },
        expected,
      ),
    ).not.toThrow();
    expect(() =>
      assertExistingIndexCompatible(
        { name: expected.options.name, key: { unexpected: 1 } },
        expected,
      ),
    ).toThrow("incompatible");
  });

  it("rejects an existing equivalent key under an unexpected name", () => {
    const expected = resolveStagingRagIndexPlan()[0];
    expect(expected).toBeDefined();
    if (!expected) return;
    expect(() =>
      assertNoExistingIndexCollision(
        [{ name: "unexpected_name", key: expected.keys }],
        expected,
      ),
    ).toThrow("collides");
    expect(assertNoExistingIndexCollision([], expected)).toBe(false);
  });
});
