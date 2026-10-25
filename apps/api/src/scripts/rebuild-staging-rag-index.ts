import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import { getConnectionToken } from "@nestjs/mongoose";
import { createHash } from "node:crypto";
import type { Connection } from "mongoose";

import {
  RAG_EMBEDDING_PROVIDER,
  type RagEmbeddingProvider,
} from "../rag/embedding/embedding-provider";
import {
  RAG_INDEX_VERSION,
  RAG_STAGING_NGRAM_EMBEDDING_MODEL,
} from "../rag/rag.constants";
import { RagIngestionService } from "../rag/rag-ingestion.service";
import type { RagSourceDocument } from "../rag/rag.types";
import { ProductRagSourceService } from "../rag/sources/product-rag-source.service";

const PREVIEW_GATE = "PREVIEW_STAGING_RAG_PRODUCTS_V1";
const APPLY_GATE = "APPLY_STAGING_RAG_PRODUCTS_V1";
const STAGING_PROJECT_ID = "farta-commerce-staging";
const STAGING_API_ID = "farta-api";
const SHA_PATTERN = /^[a-f0-9]{40}$/;
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;

type RebuildMode = "preview" | "apply";
type SnapshotCheckpoint =
  "after-preview" | "before-reconciliation" | "after-reconciliation";

export function assertStagingRagRebuildEnvironment(input: {
  appEnvironment: string | undefined;
  aiRagEnabled: string | undefined;
  approval: string | undefined;
  profile: string | undefined;
  mode: string | undefined;
  gate: string | undefined;
  northflankProjectId: string | undefined;
  northflankObjectId: string | undefined;
  deploymentSha: string | undefined;
  expectedCount?: string | undefined;
  expectedFingerprint?: string | undefined;
  expectedDatabaseFingerprint?: string | undefined;
  expectedDeploymentSha?: string | undefined;
  expectedIndexVersion?: string | undefined;
}): asserts input is typeof input & {
  mode: RebuildMode;
  deploymentSha: string;
} {
  if (input.appEnvironment !== "staging") {
    throw new Error("Staging RAG rebuild requires APP_ENV=staging.");
  }
  if (input.aiRagEnabled !== "false") {
    throw new Error("Staging RAG rebuild requires AI_RAG_ENABLED=false.");
  }
  if (input.approval !== "true") {
    throw new Error("Staging RAG rebuild requires the explicit approval gate.");
  }
  if (input.profile !== "staging-ngram-v1") {
    throw new Error(
      "Staging RAG rebuild requires the approved retrieval profile.",
    );
  }
  if (input.mode !== "preview" && input.mode !== "apply") {
    throw new Error("Staging RAG rebuild mode must be preview or apply.");
  }
  const expectedGate = input.mode === "preview" ? PREVIEW_GATE : APPLY_GATE;
  if (input.gate !== expectedGate) {
    throw new Error(
      "Staging RAG rebuild requires the exact mode-specific gate.",
    );
  }
  if (
    input.northflankProjectId !== STAGING_PROJECT_ID ||
    input.northflankObjectId !== STAGING_API_ID
  ) {
    throw new Error(
      "Staging RAG rebuild requires the expected Northflank project and API service.",
    );
  }
  if (!SHA_PATTERN.test(input.deploymentSha ?? "")) {
    throw new Error("Staging RAG rebuild requires NF_DEPLOYMENT_SHA.");
  }
  if (input.mode === "apply") {
    const count = Number(input.expectedCount);
    if (!Number.isSafeInteger(count) || count < 1) {
      throw new Error(
        "Staging RAG apply requires a positive previewed source count.",
      );
    }
    if (!FINGERPRINT_PATTERN.test(input.expectedFingerprint ?? "")) {
      throw new Error(
        "Staging RAG apply requires the previewed source fingerprint.",
      );
    }
    if (!FINGERPRINT_PATTERN.test(input.expectedDatabaseFingerprint ?? "")) {
      throw new Error(
        "Staging RAG apply requires the previewed database fingerprint.",
      );
    }
    if (!SHA_PATTERN.test(input.expectedDeploymentSha ?? "")) {
      throw new Error(
        "Staging RAG apply requires the previewed deployment SHA.",
      );
    }
    if (input.expectedIndexVersion !== RAG_INDEX_VERSION) {
      throw new Error(
        "Staging RAG apply requires the previewed index version.",
      );
    }
  }
}

export function fingerprintRagSources(
  sources: readonly RagSourceDocument[],
): string {
  const identities = sources
    .map((source) => [
      source.tenantId,
      source.sourceType,
      source.sourceId,
      source.locale,
      source.sourceVersion,
    ])
    .sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right)),
    );
  return createHash("sha256").update(JSON.stringify(identities)).digest("hex");
}

export function fingerprintRagDatabaseTarget(input: {
  host: string | undefined;
  name: string | undefined;
}): string {
  if (!input.host?.trim() || !input.name?.trim()) {
    throw new Error("Staging RAG database identity is unavailable.");
  }
  return createHash("sha256")
    .update(JSON.stringify([input.host, input.name]))
    .digest("hex");
}

export function assertRagSourceSnapshot(
  sources: readonly RagSourceDocument[],
  expectedCount: number,
  expectedFingerprint: string,
  checkpoint: SnapshotCheckpoint,
): void {
  if (
    sources.length === expectedCount &&
    fingerprintRagSources(sources) === expectedFingerprint
  ) {
    return;
  }
  const messages: Record<SnapshotCheckpoint, string> = {
    "after-preview": "Staging RAG source snapshot changed after preview.",
    "before-reconciliation":
      "Staging RAG source snapshot changed during apply; reconciliation was not run.",
    "after-reconciliation":
      "Staging RAG source snapshot changed during reconciliation; keep RAG disabled and run a new preview.",
  };
  throw new Error(messages[checkpoint]);
}

export function assertStagingRagApplyBinding(
  boundary: {
    mode: RebuildMode;
    deploymentSha: string;
    expectedDatabaseFingerprint?: string | undefined;
    expectedDeploymentSha?: string | undefined;
    expectedIndexVersion?: string | undefined;
  },
  databaseFingerprint: string,
): void {
  if (boundary.mode !== "apply") return;
  if (databaseFingerprint !== boundary.expectedDatabaseFingerprint) {
    throw new Error("Staging RAG database target changed after preview.");
  }
  if (boundary.deploymentSha !== boundary.expectedDeploymentSha) {
    throw new Error("Staging RAG deployment changed after preview.");
  }
  if (boundary.expectedIndexVersion !== RAG_INDEX_VERSION) {
    throw new Error("Staging RAG index version changed after preview.");
  }
}

export async function rebuildStagingRagIndex(): Promise<void> {
  const boundary = {
    appEnvironment: process.env.APP_ENV,
    aiRagEnabled: process.env.AI_RAG_ENABLED,
    approval: process.env.AI_RAG_STAGING_APPROVED,
    profile: process.env.AI_RAG_RETRIEVAL_PROFILE,
    mode: process.env.RAG_STAGING_REBUILD_MODE,
    gate: process.env.ALLOW_STAGING_RAG_REBUILD,
    northflankProjectId: process.env.NF_PROJECT_ID,
    northflankObjectId: process.env.NF_OBJECT_ID,
    deploymentSha: process.env.NF_DEPLOYMENT_SHA,
    expectedCount: process.env.RAG_STAGING_EXPECTED_SOURCE_COUNT,
    expectedFingerprint: process.env.RAG_STAGING_EXPECTED_SOURCE_FINGERPRINT,
    expectedDatabaseFingerprint:
      process.env.RAG_STAGING_EXPECTED_DATABASE_FINGERPRINT,
    expectedDeploymentSha: process.env.RAG_STAGING_EXPECTED_DEPLOYMENT_SHA,
    expectedIndexVersion: process.env.RAG_STAGING_EXPECTED_INDEX_VERSION,
  };
  assertStagingRagRebuildEnvironment(boundary);
  const { AppModule } = await import("../app.module");
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });
  try {
    const embeddings = app.get<RagEmbeddingProvider>(RAG_EMBEDDING_PROVIDER);
    if (
      embeddings.identity.runtimeScope !== "STAGING_APPROVED" ||
      embeddings.identity.model !== RAG_STAGING_NGRAM_EMBEDDING_MODEL
    ) {
      throw new Error(
        "Staging RAG rebuild refused an unapproved embedding profile.",
      );
    }
    const connection = app.get<Connection>(getConnectionToken());
    const databaseFingerprint = fingerprintRagDatabaseTarget({
      host: connection.host,
      name: connection.name,
    });
    assertStagingRagApplyBinding(boundary, databaseFingerprint);
    const sources = await app.get(ProductRagSourceService).listPublicSources();
    const fingerprint = fingerprintRagSources(sources);
    process.stdout.write(
      `Staging RAG ${boundary.mode}: sources=${sources.length} sourceFingerprint=${fingerprint} databaseFingerprint=${databaseFingerprint} deploymentSha=${boundary.deploymentSha} indexVersion=${RAG_INDEX_VERSION}.\n`,
    );
    if (boundary.mode === "preview") return;
    assertRagSourceSnapshot(
      sources,
      Number(boundary.expectedCount),
      boundary.expectedFingerprint ?? "",
      "after-preview",
    );

    const ingestion = app.get(RagIngestionService);
    const outcomes = new Map<string, number>();
    for (const source of sources) {
      const result = await ingestion.ingest(source);
      outcomes.set(result.outcome, (outcomes.get(result.outcome) ?? 0) + 1);
    }
    const finalSources = await app
      .get(ProductRagSourceService)
      .listPublicSources();
    assertRagSourceSnapshot(
      finalSources,
      sources.length,
      fingerprint,
      "before-reconciliation",
    );
    const reconciliation = await ingestion.reconcileCompleteSourceSet({
      tenantId: "farta",
      sourceType: "PRODUCT",
      locale: "vi",
      activeSourceIds: finalSources.map((source) => source.sourceId),
    });
    const reconciledSources = await app
      .get(ProductRagSourceService)
      .listPublicSources();
    assertRagSourceSnapshot(
      reconciledSources,
      sources.length,
      fingerprint,
      "after-reconciliation",
    );
    const summary = [...outcomes.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([outcome, count]) => `${outcome.toLowerCase()}=${count}`)
      .join(" ");
    process.stdout.write(
      `Staging RAG apply complete: sources=${sources.length} ${summary} tombstonedDocuments=${reconciliation.documentsChanged} tombstonedChunks=${reconciliation.chunksChanged}.\n`,
    );
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  void rebuildStagingRagIndex().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown error";
    process.stderr.write(`Staging RAG rebuild failed: ${message}\n`);
    process.exitCode = 1;
  });
}
