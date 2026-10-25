import { Inject, Injectable } from "@nestjs/common";

import {
  RAG_INDEX_VERSION,
  RAG_PUBLIC_AUDIENCE,
  RAG_SCHEMA_VERSION,
} from "../rag.constants";
import type {
  RagProjection,
  RagProjectedChunk,
  RagSourceDocument,
} from "../rag.types";
import { ragChunkId, ragDigest, ragDocumentId } from "../rag-identifiers";
import {
  RAG_EMBEDDING_PROVIDER,
  type RagEmbeddingProvider,
} from "../embedding/embedding-provider";
import { DeterministicRagChunker } from "./deterministic-chunker";
import { RagPublicContentPolicy } from "./public-content-policy";

@Injectable()
export class RagDocumentProjector {
  private readonly contentPolicy = new RagPublicContentPolicy();

  constructor(
    @Inject(RAG_EMBEDDING_PROVIDER)
    private readonly embeddings: RagEmbeddingProvider,
    @Inject(DeterministicRagChunker)
    private readonly chunker: DeterministicRagChunker,
  ) {}

  async project(input: RagSourceDocument): Promise<RagProjection> {
    const source = this.contentPolicy.validateAndNormalize(input);
    const content = source.contentSections.join("\n\n");
    const documentId = ragDocumentId(source);
    const contentHash = ragDigest(
      JSON.stringify({
        title: source.title,
        canonicalPath: source.canonicalPath,
        content,
        metadata: source.metadata,
      }),
    );
    const textChunks = this.chunker.chunk(content);
    if (textChunks.length === 0) throw new Error("RAG_PROJECTION_EMPTY");
    const vectors = await this.embeddings.embed(
      textChunks.map((chunk) => chunk.content),
    );
    if (vectors.length !== textChunks.length) {
      throw new Error("RAG_EMBEDDING_COUNT_MISMATCH");
    }

    const chunks: RagProjectedChunk[] = textChunks.map((chunk, index) => {
      const embedding = vectors[index];
      this.assertEmbedding(embedding);
      const chunkHash = ragDigest(chunk.content);
      return {
        tenantId: source.tenantId,
        documentId,
        chunkId: ragChunkId(
          documentId,
          source.sourceVersion,
          chunk.ordinal,
          chunkHash,
        ),
        sourceType: source.sourceType,
        sourceId: source.sourceId,
        locale: source.locale,
        audience: RAG_PUBLIC_AUDIENCE,
        title: source.title,
        canonicalPath: source.canonicalPath,
        content: chunk.content,
        contentHash: chunkHash,
        ordinal: chunk.ordinal,
        tokenEstimate: chunk.tokenEstimate,
        sourceVersion: source.sourceVersion,
        sourceUpdatedAt: source.sourceUpdatedAt,
        publishedAt: source.publishedAt,
        schemaVersion: RAG_SCHEMA_VERSION,
        indexVersion: RAG_INDEX_VERSION,
        status: "ACTIVE",
        metadata: source.metadata,
        embeddingModel: this.embeddings.identity.model,
        embeddingVersion: this.embeddings.identity.version,
        embeddingDimensions: this.embeddings.identity.dimensions,
        embedding: embedding ?? [],
      };
    });

    return {
      document: {
        tenantId: source.tenantId,
        documentId,
        sourceType: source.sourceType,
        sourceId: source.sourceId,
        locale: source.locale,
        audience: RAG_PUBLIC_AUDIENCE,
        title: source.title,
        canonicalPath: source.canonicalPath,
        content,
        contentHash,
        sourceVersion: source.sourceVersion,
        sourceUpdatedAt: source.sourceUpdatedAt,
        publishedAt: source.publishedAt,
        schemaVersion: RAG_SCHEMA_VERSION,
        indexVersion: RAG_INDEX_VERSION,
        status: "ACTIVE",
        metadata: source.metadata,
      },
      chunks,
    };
  }

  private assertEmbedding(
    embedding: number[] | undefined,
  ): asserts embedding is number[] {
    if (
      !embedding ||
      embedding.length !== this.embeddings.identity.dimensions ||
      embedding.some((value) => !Number.isFinite(value))
    ) {
      throw new Error("RAG_EMBEDDING_INVALID");
    }
  }
}
