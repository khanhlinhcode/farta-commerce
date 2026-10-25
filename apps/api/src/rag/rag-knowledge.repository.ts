import type {
  RagProjection,
  RagReconcileResult,
  RagSourceIdentity,
  RagSourceSet,
  RagTombstoneResult,
  RagWriteResult,
} from "./rag.types";

export const RAG_KNOWLEDGE_REPOSITORY = Symbol("RAG_KNOWLEDGE_REPOSITORY");

export type RagActiveSnapshot = {
  status: "ACTIVE" | "SUPERSEDED" | "TOMBSTONED";
  sourceVersion: string;
  contentHash: string;
  sourceUpdatedAt: Date;
  schemaVersion: number;
  indexVersion: string;
  chunks: RagActiveChunkSnapshot[];
};

export type RagActiveChunkSnapshot = {
  chunkId: string;
  schemaVersion: number;
  indexVersion: string;
  embeddingModel: string;
  embeddingVersion: string;
  embeddingDimensions: number;
};

export type RagProjectionDecision = RagWriteResult["outcome"];

export interface RagKnowledgeRepository {
  applyProjection(projection: RagProjection): Promise<RagWriteResult>;
  tombstone(identity: RagSourceIdentity): Promise<RagTombstoneResult>;
  tombstoneMissing(sourceSet: RagSourceSet): Promise<RagReconcileResult>;
}

export function decideRagProjection(
  active: RagActiveSnapshot | null,
  projection: RagProjection,
): RagProjectionDecision {
  if (!active) return "CREATED";
  const incoming = projection.document;
  if (
    active.status !== "ACTIVE" &&
    active.sourceUpdatedAt.getTime() >= incoming.sourceUpdatedAt.getTime()
  ) {
    return "STALE";
  }
  if (active.sourceUpdatedAt.getTime() > incoming.sourceUpdatedAt.getTime()) {
    return "STALE";
  }
  if (
    active.status === "ACTIVE" &&
    active.sourceVersion === incoming.sourceVersion &&
    active.contentHash !== incoming.contentHash
  ) {
    throw new Error("RAG_SOURCE_VERSION_CONFLICT");
  }
  const chunkProfile = (chunk: RagActiveChunkSnapshot): string =>
    JSON.stringify([
      chunk.chunkId,
      chunk.schemaVersion,
      chunk.indexVersion,
      chunk.embeddingModel,
      chunk.embeddingVersion,
      chunk.embeddingDimensions,
    ]);
  const incomingChunkProfiles = projection.chunks.map(chunkProfile).sort();
  const activeChunkProfiles = active.chunks.map(chunkProfile).sort();
  if (
    active.status === "ACTIVE" &&
    active.sourceVersion === incoming.sourceVersion &&
    active.contentHash === incoming.contentHash
  ) {
    const documentIdentityMatches =
      active.schemaVersion === incoming.schemaVersion &&
      active.indexVersion === incoming.indexVersion;
    const chunkIdentitiesMatch =
      JSON.stringify(activeChunkProfiles) ===
      JSON.stringify(incomingChunkProfiles);
    return documentIdentityMatches && chunkIdentitiesMatch
      ? "UNCHANGED"
      : "REPAIRED";
  }
  return "REPLACED";
}
