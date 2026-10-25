import "reflect-metadata";

import { NestFactory } from "@nestjs/core";

import { RagIngestionService } from "../rag/rag-ingestion.service";
import { ProductRagSourceService } from "../rag/sources/product-rag-source.service";

const LOCAL_RAG_REBUILD_GATE = "REBUILD_LOCAL_RAG_FOUNDATION_V1";

export function assertLocalRagRebuildEnvironment(
  appEnvironment: string | undefined,
  gate: string | undefined,
  mongodbUri: string | undefined,
): void {
  if (appEnvironment !== "development" || gate !== LOCAL_RAG_REBUILD_GATE) {
    throw new Error(
      "Local RAG rebuild requires APP_ENV=development and the explicit local rebuild gate.",
    );
  }
  if (!mongodbUri) {
    throw new Error("Local RAG rebuild requires a loopback MongoDB URI.");
  }
  let parsed: URL;
  try {
    parsed = new URL(mongodbUri);
  } catch {
    throw new Error("Local RAG rebuild requires a valid loopback MongoDB URI.");
  }
  const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
  if (parsed.protocol !== "mongodb:" || !loopbackHosts.has(parsed.hostname)) {
    throw new Error("Local RAG rebuild refuses non-loopback MongoDB targets.");
  }
}

export async function rebuildLocalRagIndex(): Promise<void> {
  assertLocalRagRebuildEnvironment(
    process.env.APP_ENV,
    process.env.ALLOW_LOCAL_RAG_REBUILD,
    process.env.MONGODB_URI,
  );
  const { AppModule } = await import("../app.module");
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });
  try {
    const sources = await app.get(ProductRagSourceService).listPublicSources();
    const ingestion = app.get(RagIngestionService);
    const outcomes = new Map<string, number>();
    for (const source of sources) {
      const result = await ingestion.ingest(source);
      outcomes.set(result.outcome, (outcomes.get(result.outcome) ?? 0) + 1);
    }
    const reconciliation = await ingestion.reconcileCompleteSourceSet({
      tenantId: "farta",
      sourceType: "PRODUCT",
      locale: "vi",
      activeSourceIds: sources.map((source) => source.sourceId),
    });
    const summary = [...outcomes.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([outcome, count]) => `${outcome.toLowerCase()}=${count}`)
      .join(" ");
    process.stdout.write(
      `Local RAG rebuild complete: sources=${sources.length} ${summary} tombstonedDocuments=${reconciliation.documentsChanged} tombstonedChunks=${reconciliation.chunksChanged}.\n`,
    );
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  void rebuildLocalRagIndex().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown error";
    process.stderr.write(`Local RAG rebuild failed: ${message}\n`);
    process.exitCode = 1;
  });
}
