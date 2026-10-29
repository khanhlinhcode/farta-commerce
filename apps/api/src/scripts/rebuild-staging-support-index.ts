import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import { getConnectionToken } from "@nestjs/mongoose";
import type { Connection } from "mongoose";

import { RagDocumentProjector } from "../rag/ingestion/rag-document-projector";
import { RagIngestionService } from "../rag/rag-ingestion.service";
import { RAG_INDEX_VERSION } from "../rag/rag.constants";
import { RagRetrievalService } from "../rag/retrieval/rag-retrieval.service";
import { stagingSupportRagSources } from "../rag/sources/staging-support-rag-source";
import {
  fingerprintRagDatabaseConnection,
  fingerprintRagSources,
} from "./rebuild-staging-rag-index";

const SHA = /^[a-f0-9]{40}$/;
const FINGERPRINT = /^[a-f0-9]{64}$/;
const PREVIEW_GATE = "PREVIEW_STAGING_RAG_SUPPORT_V1";
const APPLY_GATE = "APPLY_STAGING_RAG_SUPPORT_V1";

type Mode = "preview" | "apply";

export function assertStagingSupportBoundary(env: NodeJS.ProcessEnv): {
  mode: Mode;
  deploymentSha: string;
} {
  if (
    env.APP_ENV !== "staging" ||
    env.NF_PROJECT_ID !== "farta-commerce-staging" ||
    env.NF_OBJECT_ID !== "farta-api" ||
    !SHA.test(env.NF_DEPLOYMENT_SHA ?? "") ||
    env.AI_RAG_ENABLED !== "true" ||
    env.AI_RAG_STAGING_APPROVED !== "true" ||
    env.AI_RAG_RETRIEVAL_PROFILE !== "staging-ngram-v1"
  ) {
    throw new Error("Staging support RAG runtime boundary is not satisfied.");
  }
  const mode = env.RAG_STAGING_SUPPORT_MODE;
  if (mode !== "preview" && mode !== "apply") {
    throw new Error("Staging support RAG mode must be preview or apply.");
  }
  if (
    env.ALLOW_STAGING_SUPPORT_RAG_REBUILD !==
    (mode === "preview" ? PREVIEW_GATE : APPLY_GATE)
  ) {
    throw new Error("Staging support RAG requires the exact one-shot gate.");
  }
  if (mode === "apply") {
    if (
      env.RAG_STAGING_SUPPORT_EXPECTED_COUNT !== "4" ||
      !FINGERPRINT.test(
        env.RAG_STAGING_SUPPORT_EXPECTED_SOURCE_FINGERPRINT ?? "",
      ) ||
      !FINGERPRINT.test(
        env.RAG_STAGING_SUPPORT_EXPECTED_DATABASE_FINGERPRINT ?? "",
      ) ||
      !SHA.test(env.RAG_STAGING_SUPPORT_EXPECTED_DEPLOYMENT_SHA ?? "") ||
      env.RAG_STAGING_SUPPORT_EXPECTED_INDEX_VERSION !== RAG_INDEX_VERSION
    ) {
      throw new Error(
        "Staging support RAG apply requires the preview binding.",
      );
    }
  }
  return { mode, deploymentSha: env.NF_DEPLOYMENT_SHA! };
}

export async function rebuildStagingSupportIndex(): Promise<void> {
  const boundary = assertStagingSupportBoundary(process.env);
  const sources = stagingSupportRagSources();
  if (
    sources.length !== 4 ||
    new Set(sources.map((source) => source.sourceType)).size !== 4 ||
    sources.some((source) => !source.canonicalPath.startsWith("/help/"))
  ) {
    throw new Error(
      "Staging support source set is not the approved four topics.",
    );
  }

  const { AppModule } = await import("../app.module");
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });
  try {
    const connection = app.get<Connection>(getConnectionToken());
    const databaseFingerprint = fingerprintRagDatabaseConnection(connection);
    const sourceFingerprint = fingerprintRagSources(sources);
    const projector = app.get(RagDocumentProjector);
    await Promise.all(sources.map((source) => projector.project(source)));
    const existing = await connection
      .getClient()
      .db(connection.name)
      .collection("rag_knowledge_documents")
      .find(
        {
          tenantId: "farta",
          locale: "vi",
          audience: "PUBLIC",
          status: "ACTIVE",
          sourceType: { $in: sources.map((source) => source.sourceType) },
        },
        { projection: { _id: 0, sourceType: 1, sourceId: 1 } },
      )
      .toArray();
    const expected = new Set(
      sources.map((source) => `${source.sourceType}:${source.sourceId}`),
    );
    if (
      existing.some(
        (entry) => !expected.has(`${entry.sourceType}:${entry.sourceId}`),
      )
    ) {
      throw new Error("Unknown active staging support RAG source exists.");
    }
    process.stdout.write(
      `Staging support RAG ${boundary.mode}: sources=4 existing=${existing.length} sourceFingerprint=${sourceFingerprint} databaseFingerprint=${databaseFingerprint} deploymentSha=${boundary.deploymentSha} indexVersion=${RAG_INDEX_VERSION}.\n`,
    );
    if (boundary.mode === "preview") return;

    if (
      process.env.RAG_STAGING_SUPPORT_EXPECTED_SOURCE_FINGERPRINT !==
        sourceFingerprint ||
      process.env.RAG_STAGING_SUPPORT_EXPECTED_DATABASE_FINGERPRINT !==
        databaseFingerprint ||
      process.env.RAG_STAGING_SUPPORT_EXPECTED_DEPLOYMENT_SHA !==
        boundary.deploymentSha
    ) {
      throw new Error("Staging support RAG preview binding changed.");
    }

    const ingestion = app.get(RagIngestionService);
    for (const source of sources) await ingestion.ingest(source);

    const retrieval = app.get(RagRetrievalService);
    const probes = [
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
        query: probes[index]!,
        limit: 5,
      });
      if (
        !result.hits.some(
          (hit) =>
            hit.citation.sourceId === source.sourceId &&
            hit.citation.canonicalPath === source.canonicalPath,
        )
      ) {
        throw new Error("Staging support RAG retrieval acceptance failed.");
      }
    }
    process.stdout.write(
      "Staging support RAG apply complete: sources=4 retrieval=4/4.\n",
    );
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  void rebuildStagingSupportIndex().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown error";
    process.stderr.write(`Staging support RAG failed: ${message}\n`);
    process.exitCode = 1;
  });
}
