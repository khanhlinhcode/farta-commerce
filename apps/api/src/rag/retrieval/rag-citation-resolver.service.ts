import { Inject, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";

import {
  RAG_EMBEDDING_PROVIDER,
  type RagEmbeddingProvider,
} from "../embedding/embedding-provider";
import { RAG_INDEX_VERSION } from "../rag.constants";
import {
  KnowledgeChunk,
  type KnowledgeChunkDocument,
} from "../schemas/knowledge-chunk.schema";
import type { RagCitation } from "./rag-retrieval.types";

const citationPattern = /^citation:(ragchunk_[a-f0-9]{64})$/;

@Injectable()
export class RagCitationResolverService {
  constructor(
    @InjectModel(KnowledgeChunk.name)
    private readonly chunks: Model<KnowledgeChunkDocument>,
    @Inject(RAG_EMBEDDING_PROVIDER)
    private readonly embeddings: RagEmbeddingProvider,
  ) {}

  async resolveActive(
    tenantId: string,
    citationIds: readonly string[],
  ): Promise<RagCitation[]> {
    const unique = [...new Set(citationIds)];
    if (unique.length !== citationIds.length || unique.length > 8) {
      throw new Error("RAG_CITATION_SET_INVALID");
    }
    const chunkIds = unique.map((citationId) => {
      const match = citationPattern.exec(citationId);
      if (!match?.[1]) throw new Error("RAG_CITATION_ID_INVALID");
      return match[1];
    });
    if (chunkIds.length === 0) return [];
    const records = await this.chunks
      .find({
        tenantId,
        chunkId: { $in: chunkIds },
        audience: "PUBLIC",
        status: "ACTIVE",
        indexVersion: RAG_INDEX_VERSION,
        embeddingModel: this.embeddings.identity.model,
        embeddingVersion: this.embeddings.identity.version,
        embeddingDimensions: this.embeddings.identity.dimensions,
      })
      .select({
        _id: 0,
        chunkId: 1,
        sourceType: 1,
        sourceId: 1,
        title: 1,
        canonicalPath: 1,
        content: 1,
        ordinal: 1,
        sourceVersion: 1,
        sourceUpdatedAt: 1,
      })
      .lean()
      .exec();
    const byChunkId = new Map(
      records.map((record) => [record.chunkId, record]),
    );
    return chunkIds.flatMap((chunkId) => {
      const record = byChunkId.get(chunkId);
      return record
        ? [
            {
              citationId: `citation:${record.chunkId}`,
              sourceType: record.sourceType,
              sourceId: record.sourceId,
              title: record.title,
              canonicalPath: record.canonicalPath,
              chunkId: record.chunkId,
              chunkOrdinal: record.ordinal,
              excerpt: record.content,
              sourceVersion: record.sourceVersion,
              sourceUpdatedAt: record.sourceUpdatedAt.toISOString(),
              contentTrust: "UNTRUSTED_PUBLIC_CONTENT" as const,
            },
          ]
        : [];
    });
  }
}
