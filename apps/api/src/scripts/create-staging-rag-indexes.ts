import mongoose, {
  type Connection,
  type IndexOptions,
  type Schema,
} from "mongoose";

import { KnowledgeChunkSchema } from "../rag/schemas/knowledge-chunk.schema";
import { KnowledgeDocumentSchema } from "../rag/schemas/knowledge-document.schema";
import { fingerprintRagDatabaseTarget } from "./rebuild-staging-rag-index";

const STAGING_GATE = "CREATE_STAGING_RAG_INDEXES_V1";
const STAGING_PROJECT_ID = "farta-commerce-staging";
const STAGING_API_ID = "farta-api";
const SHA_PATTERN = /^[a-f0-9]{40}$/;
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;
const DOCUMENT_COLLECTION = "rag_knowledge_documents";
const CHUNK_COLLECTION = "rag_knowledge_chunks";

const EXPECTED_INDEX_NAMES = [
  "rag_document_version_unique",
  "rag_document_active_unique",
  "rag_document_public_lookup",
  "rag_chunk_unique",
  "rag_chunk_document_version_ordinal_unique",
  "rag_chunk_public_filter",
] as const;

type RagIndexDefinition = {
  collectionName: string;
  keys: Record<string, 1 | -1>;
  options: IndexOptions & { name: string };
};

type StoredIndexDescription = {
  name?: string;
  key?: Record<string, number | string>;
  unique?: boolean;
  partialFilterExpression?: unknown;
};

type StagingRagIndexBoundary = {
  appEnvironment: string | undefined;
  aiRagEnabled: string | undefined;
  approval: string | undefined;
  profile: string | undefined;
  capacityApproved: string | undefined;
  gate: string | undefined;
  northflankProjectId: string | undefined;
  northflankObjectId: string | undefined;
  deploymentSha: string | undefined;
  expectedDeploymentSha: string | undefined;
  expectedDatabaseFingerprint: string | undefined;
  expectedDocumentCount: string | undefined;
  expectedChunkCount: string | undefined;
};

function parseExpectedCount(value: string | undefined): number | null {
  if (!/^(0|[1-9][0-9]*)$/.test(value ?? "")) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function assertStagingRagIndexEnvironment(
  boundary: StagingRagIndexBoundary,
): asserts boundary is StagingRagIndexBoundary & {
  deploymentSha: string;
  expectedDeploymentSha: string;
  expectedDatabaseFingerprint: string;
  expectedDocumentCount: string;
  expectedChunkCount: string;
} {
  if (boundary.appEnvironment !== "staging") {
    throw new Error("Staging RAG index creation requires APP_ENV=staging.");
  }
  if (boundary.aiRagEnabled !== "false") {
    throw new Error(
      "Staging RAG index creation requires AI_RAG_ENABLED=false.",
    );
  }
  if (boundary.approval !== "true") {
    throw new Error(
      "Staging RAG index creation requires AI_RAG_STAGING_APPROVED=true.",
    );
  }
  if (boundary.profile !== "staging-ngram-v1") {
    throw new Error(
      "Staging RAG index creation requires the approved retrieval profile.",
    );
  }
  if (boundary.capacityApproved !== "true") {
    throw new Error(
      "Staging RAG index creation requires private Atlas capacity approval.",
    );
  }
  if (boundary.gate !== STAGING_GATE) {
    throw new Error(
      "Staging RAG index creation requires the exact one-time gate.",
    );
  }
  if (
    boundary.northflankProjectId !== STAGING_PROJECT_ID ||
    boundary.northflankObjectId !== STAGING_API_ID
  ) {
    throw new Error(
      "Staging RAG index creation requires the expected Northflank project and API service.",
    );
  }
  if (
    !SHA_PATTERN.test(boundary.deploymentSha ?? "") ||
    boundary.deploymentSha !== boundary.expectedDeploymentSha
  ) {
    throw new Error(
      "Staging RAG index creation requires the exact previewed deployment SHA.",
    );
  }
  if (!FINGERPRINT_PATTERN.test(boundary.expectedDatabaseFingerprint ?? "")) {
    throw new Error(
      "Staging RAG index creation requires the previewed database fingerprint.",
    );
  }
  if (
    parseExpectedCount(boundary.expectedDocumentCount) === null ||
    parseExpectedCount(boundary.expectedChunkCount) === null
  ) {
    throw new Error(
      "Staging RAG index creation requires exact previewed document and chunk counts.",
    );
  }
}

function schemaIndexDefinitions(
  collectionName: string,
  schema: Schema,
): RagIndexDefinition[] {
  return schema.indexes().map(([keys, options]) => {
    if (!options.name) {
      throw new Error("Every staging RAG index must have an explicit name.");
    }
    const unsupportedOptions = Object.keys(options).filter(
      (key) => !["name", "unique", "partialFilterExpression"].includes(key),
    );
    if (unsupportedOptions.length > 0) {
      throw new Error(
        `Unsupported staging RAG index options: ${unsupportedOptions.sort().join(",")}.`,
      );
    }
    const normalizedKeys = Object.fromEntries(
      Object.entries(keys).map(([key, direction]) => {
        if (direction !== 1 && direction !== -1) {
          throw new Error(
            `Unsupported staging RAG index direction: ${String(direction)}.`,
          );
        }
        return [key, direction];
      }),
    ) as Record<string, 1 | -1>;
    return {
      collectionName,
      keys: normalizedKeys,
      options: { ...options, name: options.name },
    };
  });
}

export function resolveStagingRagIndexPlan(): RagIndexDefinition[] {
  const plan = [
    ...schemaIndexDefinitions(DOCUMENT_COLLECTION, KnowledgeDocumentSchema),
    ...schemaIndexDefinitions(CHUNK_COLLECTION, KnowledgeChunkSchema),
  ];
  const actualNames = plan.map(({ options }) => options.name).sort();
  const expectedNames = [...EXPECTED_INDEX_NAMES].sort();
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
    throw new Error(
      "Staging RAG index plan changed; review and update the explicit allowlist.",
    );
  }
  return plan;
}

function comparableKey(key: StoredIndexDescription["key"] | undefined) {
  return Object.entries(key ?? {});
}

function comparablePartialFilter(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function assertExistingIndexCompatible(
  existing: StoredIndexDescription,
  expected: RagIndexDefinition,
): void {
  const keyMatches =
    JSON.stringify(comparableKey(existing.key)) ===
    JSON.stringify(comparableKey(expected.keys));
  const uniqueMatches =
    Boolean(existing.unique) === Boolean(expected.options.unique);
  const partialFilterMatches =
    comparablePartialFilter(existing.partialFilterExpression) ===
    comparablePartialFilter(expected.options.partialFilterExpression);
  if (!keyMatches || !uniqueMatches || !partialFilterMatches) {
    throw new Error(
      `Existing staging RAG index is incompatible: ${expected.options.name}.`,
    );
  }
}

export function assertNoExistingIndexCollision(
  existingIndexes: readonly StoredIndexDescription[],
  expected: RagIndexDefinition,
): boolean {
  const sameName = existingIndexes.find(
    (candidate) => candidate.name === expected.options.name,
  );
  if (sameName) {
    assertExistingIndexCompatible(sameName, expected);
    return true;
  }
  const sameKey = existingIndexes.find(
    (candidate) =>
      JSON.stringify(comparableKey(candidate.key)) ===
      JSON.stringify(comparableKey(expected.keys)),
  );
  if (sameKey) {
    throw new Error(
      `Existing staging RAG index collides with the approved plan: ${expected.options.name}.`,
    );
  }
  return false;
}

async function listIndexes(
  connection: Connection,
  collectionName: string,
): Promise<StoredIndexDescription[]> {
  const database = connection.db;
  if (!database) throw new Error("Staging RAG database is unavailable.");
  const exists = await database
    .listCollections({ name: collectionName }, { nameOnly: true })
    .hasNext();
  if (!exists) return [];
  const indexes = await database
    .collection(collectionName)
    .listIndexes()
    .toArray();
  return indexes.map((index) => ({
    name: index.name,
    key: index.key as Record<string, number | string>,
    unique: index.unique,
    partialFilterExpression: index.partialFilterExpression,
  }));
}

async function assertNoDuplicateKeys(
  connection: Connection,
  definition: RagIndexDefinition,
): Promise<void> {
  if (!definition.options.unique) return;
  const database = connection.db;
  if (!database) throw new Error("Staging RAG database is unavailable.");
  const groupKey = Object.fromEntries(
    Object.keys(definition.keys).map((key) => [key, `$${key}`]),
  );
  const pipeline: Record<string, unknown>[] = [];
  if (definition.options.partialFilterExpression) {
    pipeline.push({ $match: definition.options.partialFilterExpression });
  }
  pipeline.push(
    { $group: { _id: groupKey, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $limit: 1 },
  );
  const duplicate = await database
    .collection(definition.collectionName)
    .aggregate(pipeline, { allowDiskUse: false, maxTimeMS: 10_000 })
    .hasNext();
  if (duplicate) {
    throw new Error(
      `Staging RAG index duplicate conflict: ${definition.options.name}.`,
    );
  }
}

function boundaryFromEnvironment(): StagingRagIndexBoundary {
  return {
    appEnvironment: process.env.APP_ENV,
    aiRagEnabled: process.env.AI_RAG_ENABLED,
    approval: process.env.AI_RAG_STAGING_APPROVED,
    profile: process.env.AI_RAG_RETRIEVAL_PROFILE,
    capacityApproved: process.env.RAG_STAGING_ATLAS_CAPACITY_APPROVED,
    gate: process.env.ALLOW_STAGING_RAG_INDEX_BOOTSTRAP,
    northflankProjectId: process.env.NF_PROJECT_ID,
    northflankObjectId: process.env.NF_OBJECT_ID,
    deploymentSha: process.env.NF_DEPLOYMENT_SHA,
    expectedDeploymentSha: process.env.RAG_STAGING_EXPECTED_DEPLOYMENT_SHA,
    expectedDatabaseFingerprint:
      process.env.RAG_STAGING_EXPECTED_DATABASE_FINGERPRINT,
    expectedDocumentCount: process.env.RAG_STAGING_EXPECTED_DOCUMENT_COUNT,
    expectedChunkCount: process.env.RAG_STAGING_EXPECTED_CHUNK_COUNT,
  };
}

export async function createStagingRagIndexes(): Promise<void> {
  const boundary = boundaryFromEnvironment();
  assertStagingRagIndexEnvironment(boundary);
  const mongodbUri = process.env.MONGODB_URI;
  if (!mongodbUri) {
    throw new Error("Staging RAG index creation requires MONGODB_URI.");
  }

  const connection = await mongoose
    .createConnection(mongodbUri, {
      autoIndex: false,
      sanitizeFilter: true,
      serverSelectionTimeoutMS: 5_000,
    })
    .asPromise();
  try {
    const databaseFingerprint = fingerprintRagDatabaseTarget({
      host: connection.host,
      name: connection.name,
    });
    if (databaseFingerprint !== boundary.expectedDatabaseFingerprint) {
      throw new Error(
        "Staging RAG database target changed after the approved preview.",
      );
    }

    const collectionNames = [DOCUMENT_COLLECTION, CHUNK_COLLECTION];
    const expectedCounts = new Map<string, number>([
      [DOCUMENT_COLLECTION, Number(boundary.expectedDocumentCount)],
      [CHUNK_COLLECTION, Number(boundary.expectedChunkCount)],
    ]);
    const plan = resolveStagingRagIndexPlan();
    const missing: RagIndexDefinition[] = [];
    const database = connection.db;
    if (!database) throw new Error("Staging RAG database is unavailable.");

    for (const collectionName of collectionNames) {
      const count = await database
        .collection(collectionName)
        .countDocuments({}, { maxTimeMS: 10_000 });
      if (count !== expectedCounts.get(collectionName)) {
        throw new Error(
          `Staging RAG ${collectionName} count changed after preflight.`,
        );
      }
      const existingIndexes = await listIndexes(connection, collectionName);
      for (const definition of plan.filter(
        (candidate) => candidate.collectionName === collectionName,
      )) {
        if (!assertNoExistingIndexCollision(existingIndexes, definition)) {
          missing.push(definition);
        }
        await assertNoDuplicateKeys(connection, definition);
      }
    }

    for (const collectionName of collectionNames) {
      const pending = missing.filter(
        (definition) => definition.collectionName === collectionName,
      );
      if (pending.length === 0) continue;
      for (const { keys, options } of pending) {
        await database.collection(collectionName).createIndex(keys, {
          name: options.name,
          unique: Boolean(options.unique),
          ...(options.partialFilterExpression
            ? { partialFilterExpression: options.partialFilterExpression }
            : {}),
        });
      }
    }

    for (const definition of plan) {
      const existing = (
        await listIndexes(connection, definition.collectionName)
      ).find((candidate) => candidate.name === definition.options.name);
      if (!existing) {
        throw new Error(
          `Staging RAG index verification failed: ${definition.options.name}.`,
        );
      }
      assertExistingIndexCompatible(existing, definition);
    }

    process.stdout.write(
      `Staging RAG index creation complete: created=${missing.length} verified=${plan.length} databaseFingerprint=${databaseFingerprint} deploymentSha=${boundary.deploymentSha}.\n`,
    );
  } finally {
    await connection.close();
  }
}

if (require.main === module) {
  void createStagingRagIndexes().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown error";
    process.stderr.write(`Staging RAG index creation failed: ${message}\n`);
    process.exitCode = 1;
  });
}
