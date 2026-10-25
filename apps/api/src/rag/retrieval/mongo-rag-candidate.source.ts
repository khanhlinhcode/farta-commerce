import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model, QueryFilter } from "mongoose";

import {
  KnowledgeChunk,
  type KnowledgeChunkDocument,
} from "../schemas/knowledge-chunk.schema";
import type { RagCandidateSource } from "./rag-candidate.source";
import type {
  RagRetrievalCandidate,
  RagRetrievalCandidateQuery,
} from "./rag-retrieval.types";

@Injectable()
export class MongoRagCandidateSource implements RagCandidateSource {
  constructor(
    @InjectModel(KnowledgeChunk.name)
    private readonly chunks: Model<KnowledgeChunkDocument>,
  ) {}

  async listCandidates(
    query: RagRetrievalCandidateQuery,
  ): Promise<RagRetrievalCandidate[]> {
    const filter: QueryFilter<KnowledgeChunk> = {
      tenantId: query.tenantId,
      audience: "PUBLIC",
      status: "ACTIVE",
      locale: query.locale,
      sourceType: { $in: [...query.sourceTypes] },
      indexVersion: query.indexVersion,
      embeddingModel: query.embeddingModel,
      embeddingVersion: query.embeddingVersion,
      embeddingDimensions: query.embeddingDimensions,
      ...(query.categoryIds?.length
        ? { "metadata.categoryIds": { $in: [...query.categoryIds] } }
        : {}),
      ...(query.tags?.length
        ? { "metadata.tags": { $in: [...query.tags] } }
        : {}),
    };
    const candidates = await this.chunks
      .find(filter)
      .sort({ sourceUpdatedAt: -1, chunkId: 1 })
      .limit(query.maxCandidates)
      .select({
        _id: 0,
        documentId: 1,
        chunkId: 1,
        sourceType: 1,
        sourceId: 1,
        locale: 1,
        title: 1,
        canonicalPath: 1,
        content: 1,
        ordinal: 1,
        sourceVersion: 1,
        sourceUpdatedAt: 1,
        metadata: 1,
        indexVersion: 1,
        embeddingModel: 1,
        embeddingVersion: 1,
        embeddingDimensions: 1,
        embedding: 1,
      })
      .lean()
      .exec();
    return candidates as RagRetrievalCandidate[];
  }
}
