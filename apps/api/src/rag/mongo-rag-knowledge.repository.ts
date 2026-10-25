import { Injectable } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import type { Connection, Model } from "mongoose";

import { ragDocumentId } from "./rag-identifiers";
import {
  decideRagProjection,
  type RagActiveSnapshot,
  type RagKnowledgeRepository,
} from "./rag-knowledge.repository";
import type {
  RagProjection,
  RagReconcileResult,
  RagSourceIdentity,
  RagSourceSet,
  RagTombstoneResult,
  RagWriteResult,
} from "./rag.types";
import {
  KnowledgeChunk,
  type KnowledgeChunkDocument,
} from "./schemas/knowledge-chunk.schema";
import {
  KnowledgeDocument,
  type KnowledgeDocumentDocument,
} from "./schemas/knowledge-document.schema";

@Injectable()
export class MongoRagKnowledgeRepository implements RagKnowledgeRepository {
  constructor(
    @InjectModel(KnowledgeDocument.name)
    private readonly documents: Model<KnowledgeDocumentDocument>,
    @InjectModel(KnowledgeChunk.name)
    private readonly chunks: Model<KnowledgeChunkDocument>,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async applyProjection(projection: RagProjection): Promise<RagWriteResult> {
    const { document } = projection;
    const current = await this.documents
      .findOne({
        tenantId: document.tenantId,
        documentId: document.documentId,
      })
      .sort({ sourceUpdatedAt: -1, updatedAt: -1 })
      .select({
        status: 1,
        sourceVersion: 1,
        contentHash: 1,
        sourceUpdatedAt: 1,
        schemaVersion: 1,
        indexVersion: 1,
      })
      .lean()
      .exec();
    const activeChunks =
      current?.status === "ACTIVE"
        ? await this.chunks
            .find({
              tenantId: document.tenantId,
              documentId: document.documentId,
              status: "ACTIVE",
            })
            .select({
              _id: 0,
              chunkId: 1,
              schemaVersion: 1,
              indexVersion: 1,
              embeddingModel: 1,
              embeddingVersion: 1,
              embeddingDimensions: 1,
            })
            .lean()
            .exec()
        : [];
    const snapshot: RagActiveSnapshot | null = current
      ? {
          status: current.status,
          sourceVersion: current.sourceVersion,
          contentHash: current.contentHash,
          sourceUpdatedAt: current.sourceUpdatedAt,
          schemaVersion: current.schemaVersion,
          indexVersion: current.indexVersion,
          chunks: activeChunks,
        }
      : null;
    const outcome = decideRagProjection(snapshot, projection);
    if (outcome === "UNCHANGED" || outcome === "STALE") {
      return {
        outcome,
        documentId: document.documentId,
        sourceVersion: document.sourceVersion,
        chunks: projection.chunks.length,
      };
    }

    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        const identity = {
          tenantId: document.tenantId,
          documentId: document.documentId,
        };
        await this.documents.updateMany(
          { ...identity, status: "ACTIVE" },
          { $set: { status: "SUPERSEDED" } },
          { session },
        );
        await this.chunks.updateMany(
          { ...identity, status: "ACTIVE" },
          { $set: { status: "SUPERSEDED" } },
          { session },
        );
        await this.documents.updateOne(
          {
            ...identity,
            sourceVersion: document.sourceVersion,
          },
          { $set: { ...document, deletedAt: null } },
          { upsert: true, session },
        );
        if (projection.chunks.length > 0) {
          await this.chunks.bulkWrite(
            projection.chunks.map((chunk) => ({
              updateOne: {
                filter: {
                  tenantId: chunk.tenantId,
                  chunkId: chunk.chunkId,
                },
                update: { $set: { ...chunk, deletedAt: null } },
                upsert: true,
              },
            })),
            { session },
          );
        }
        await this.chunks.updateMany(
          {
            ...identity,
            sourceVersion: document.sourceVersion,
            chunkId: { $nin: projection.chunks.map((chunk) => chunk.chunkId) },
          },
          { $set: { status: "SUPERSEDED" } },
          { session },
        );
      });
    } finally {
      await session.endSession();
    }
    return {
      outcome,
      documentId: document.documentId,
      sourceVersion: document.sourceVersion,
      chunks: projection.chunks.length,
    };
  }

  async tombstone(identity: RagSourceIdentity): Promise<RagTombstoneResult> {
    const documentId = ragDocumentId(identity);
    const deletedAt = new Date();
    const session = await this.connection.startSession();
    let documentsChanged = 0;
    let chunksChanged = 0;
    try {
      await session.withTransaction(async () => {
        const filter = {
          tenantId: identity.tenantId,
          documentId,
          status: "ACTIVE" as const,
        };
        const documents = await this.documents.updateMany(
          filter,
          { $set: { status: "TOMBSTONED", deletedAt } },
          { session },
        );
        const chunks = await this.chunks.updateMany(
          filter,
          { $set: { status: "TOMBSTONED", deletedAt } },
          { session },
        );
        documentsChanged = documents.modifiedCount;
        chunksChanged = chunks.modifiedCount;
      });
    } finally {
      await session.endSession();
    }
    return { documentId, documentsChanged, chunksChanged };
  }

  async tombstoneMissing(sourceSet: RagSourceSet): Promise<RagReconcileResult> {
    const deletedAt = new Date();
    const filter = {
      tenantId: sourceSet.tenantId,
      sourceType: sourceSet.sourceType,
      locale: sourceSet.locale,
      status: "ACTIVE" as const,
      sourceId: { $nin: [...new Set(sourceSet.activeSourceIds)] },
    };
    const session = await this.connection.startSession();
    let documentsChanged = 0;
    let chunksChanged = 0;
    try {
      await session.withTransaction(async () => {
        const documents = await this.documents.updateMany(
          filter,
          { $set: { status: "TOMBSTONED", deletedAt } },
          { session },
        );
        const chunks = await this.chunks.updateMany(
          filter,
          { $set: { status: "TOMBSTONED", deletedAt } },
          { session },
        );
        documentsChanged = documents.modifiedCount;
        chunksChanged = chunks.modifiedCount;
      });
    } finally {
      await session.endSession();
    }
    return { documentsChanged, chunksChanged };
  }
}
