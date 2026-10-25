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
  chunkIds: string[];
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
  const incomingChunkIds = projection.chunks
    .map((chunk) => chunk.chunkId)
    .sort();
  const activeChunkIds = [...active.chunkIds].sort();
  if (
    active.status === "ACTIVE" &&
    active.sourceVersion === incoming.sourceVersion &&
    active.contentHash === incoming.contentHash
  ) {
    return JSON.stringify(activeChunkIds) === JSON.stringify(incomingChunkIds)
      ? "UNCHANGED"
      : "REPAIRED";
  }
  return "REPLACED";
}
