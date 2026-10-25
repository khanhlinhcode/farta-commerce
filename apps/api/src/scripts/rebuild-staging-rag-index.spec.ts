import { describe, expect, it } from "vitest";

import type { RagSourceDocument } from "../rag/rag.types";
import { RAG_INDEX_VERSION } from "../rag/rag.constants";
import {
  assertStagingRagApplyBinding,
  assertStagingRagRebuildEnvironment,
  assertRagSourceSnapshot,
  fingerprintRagDatabaseTarget,
  fingerprintRagSources,
} from "./rebuild-staging-rag-index";

const deploymentSha = "a".repeat(40);
const databaseFingerprint = fingerprintRagDatabaseTarget({
  host: "staging-mongo.internal",
  name: "farta-staging",
});
const preview = {
  appEnvironment: "staging",
  aiRagEnabled: "false",
  approval: "true",
  profile: "staging-ngram-v1",
  mode: "preview",
  gate: "PREVIEW_STAGING_RAG_PRODUCTS_V1",
  northflankProjectId: "farta-commerce-staging",
  northflankObjectId: "farta-api",
  deploymentSha,
};

function source(sourceId: string, sourceVersion: string): RagSourceDocument {
  return {
    tenantId: "farta",
    sourceType: "PRODUCT",
    sourceId,
    locale: "vi",
    title: sourceId,
    canonicalPath: `/product/${sourceId}`,
    contentSections: [sourceId],
    sourceVersion,
    sourceUpdatedAt: new Date("2026-10-25T00:00:00.000Z"),
    publishedAt: null,
    metadata: { productSlug: sourceId, categoryIds: [], tags: [] },
  };
}

describe("staging RAG rebuild gate", () => {
  it("allows an exact preview without expected mutation metadata", () => {
    expect(() => assertStagingRagRebuildEnvironment(preview)).not.toThrow();
  });

  it("requires an exact preview fingerprint before apply", () => {
    expect(() =>
      assertStagingRagRebuildEnvironment({
        ...preview,
        mode: "apply",
        gate: "APPLY_STAGING_RAG_PRODUCTS_V1",
      }),
    ).toThrow("previewed source count");
    expect(() =>
      assertStagingRagRebuildEnvironment({
        ...preview,
        mode: "apply",
        gate: "APPLY_STAGING_RAG_PRODUCTS_V1",
        expectedCount: "2",
        expectedFingerprint: "a".repeat(64),
        expectedDatabaseFingerprint: databaseFingerprint,
        expectedDeploymentSha: deploymentSha,
        expectedIndexVersion: RAG_INDEX_VERSION,
      }),
    ).not.toThrow();
  });

  it.each([
    { appEnvironment: "production" },
    { aiRagEnabled: "true" },
    { approval: "false" },
    { profile: "deterministic-local" },
    { gate: "APPLY_STAGING_RAG_PRODUCTS_V1" },
    { northflankProjectId: "production" },
    { northflankObjectId: "farta-ai" },
    { deploymentSha: "latest" },
  ])("rejects an unsafe boundary override", (override) => {
    expect(() =>
      assertStagingRagRebuildEnvironment({ ...preview, ...override }),
    ).toThrow();
  });

  it("binds apply to the previewed database, deployment and index", () => {
    const apply = {
      ...preview,
      mode: "apply" as const,
      expectedDatabaseFingerprint: databaseFingerprint,
      expectedDeploymentSha: deploymentSha,
      expectedIndexVersion: RAG_INDEX_VERSION,
    };
    expect(() =>
      assertStagingRagApplyBinding(apply, databaseFingerprint),
    ).not.toThrow();
    expect(() => assertStagingRagApplyBinding(apply, "b".repeat(64))).toThrow(
      "database target changed",
    );
    expect(() =>
      assertStagingRagApplyBinding(
        { ...apply, deploymentSha: "b".repeat(40) },
        databaseFingerprint,
      ),
    ).toThrow("deployment changed");
  });

  it("fingerprints database metadata without returning it", () => {
    expect(databaseFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(databaseFingerprint).not.toContain("staging-mongo");
    expect(() =>
      fingerprintRagDatabaseTarget({ host: "", name: "farta-staging" }),
    ).toThrow("identity is unavailable");
  });

  it("fingerprints source identity/version independent of ordering", () => {
    const first = source("first", "v1");
    const second = source("second", "v2");
    expect(fingerprintRagSources([first, second])).toBe(
      fingerprintRagSources([second, first]),
    );
    expect(fingerprintRagSources([first, second])).not.toBe(
      fingerprintRagSources([first, source("second", "v3")]),
    );
    expect(() =>
      assertRagSourceSnapshot(
        [second, first],
        2,
        fingerprintRagSources([first, second]),
        "before-reconciliation",
      ),
    ).not.toThrow();
    expect(() =>
      assertRagSourceSnapshot(
        [first, source("second", "v3")],
        2,
        fingerprintRagSources([first, second]),
        "before-reconciliation",
      ),
    ).toThrow("reconciliation was not run");
  });
});
