import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";

import type { Environment } from "../config/environment";
import { ProductsModule } from "../products/products.module";
import { DeterministicEmbeddingProvider } from "./embedding/deterministic-embedding.provider";
import {
  RAG_EMBEDDING_PROVIDER,
  type RagEmbeddingProvider,
} from "./embedding/embedding-provider";
import { StagingNgramEmbeddingProvider } from "./embedding/staging-ngram-embedding.provider";
import {
  DeterministicRagChunker,
  RAG_CHUNK_MAX_CHARACTERS,
} from "./ingestion/deterministic-chunker";
import { RagDocumentProjector } from "./ingestion/rag-document-projector";
import { MongoRagKnowledgeRepository } from "./mongo-rag-knowledge.repository";
import { RagIngestionService } from "./rag-ingestion.service";
import { RAG_KNOWLEDGE_REPOSITORY } from "./rag-knowledge.repository";
import { RAG_CANDIDATE_SOURCE } from "./retrieval/rag-candidate.source";
import { RagCitationResolverService } from "./retrieval/rag-citation-resolver.service";
import { MongoRagCandidateSource } from "./retrieval/mongo-rag-candidate.source";
import {
  RAG_RUNTIME_ENVIRONMENT,
  RagRetrievalService,
} from "./retrieval/rag-retrieval.service";
import {
  KnowledgeChunk,
  KnowledgeChunkSchema,
} from "./schemas/knowledge-chunk.schema";
import {
  KnowledgeDocument,
  KnowledgeDocumentSchema,
} from "./schemas/knowledge-document.schema";
import { ProductRagSourceService } from "./sources/product-rag-source.service";

@Module({
  imports: [
    ProductsModule,
    MongooseModule.forFeature([
      { name: KnowledgeDocument.name, schema: KnowledgeDocumentSchema },
      { name: KnowledgeChunk.name, schema: KnowledgeChunkSchema },
    ]),
  ],
  providers: [
    { provide: RAG_CHUNK_MAX_CHARACTERS, useValue: 1_200 },
    DeterministicRagChunker,
    DeterministicEmbeddingProvider,
    StagingNgramEmbeddingProvider,
    {
      provide: RAG_EMBEDDING_PROVIDER,
      inject: [
        ConfigService,
        DeterministicEmbeddingProvider,
        StagingNgramEmbeddingProvider,
      ],
      useFactory: (
        config: ConfigService<Environment, true>,
        deterministic: DeterministicEmbeddingProvider,
        staging: StagingNgramEmbeddingProvider,
      ): RagEmbeddingProvider =>
        config.get("AI_RAG_RETRIEVAL_PROFILE", { infer: true }) ===
        "staging-ngram-v1"
          ? staging
          : deterministic,
    },
    RagDocumentProjector,
    MongoRagKnowledgeRepository,
    {
      provide: RAG_KNOWLEDGE_REPOSITORY,
      useExisting: MongoRagKnowledgeRepository,
    },
    RagIngestionService,
    ProductRagSourceService,
    MongoRagCandidateSource,
    {
      provide: RAG_CANDIDATE_SOURCE,
      useExisting: MongoRagCandidateSource,
    },
    {
      provide: RAG_RUNTIME_ENVIRONMENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => config.getOrThrow("APP_ENV"),
    },
    RagRetrievalService,
    RagCitationResolverService,
  ],
  exports: [
    RagIngestionService,
    ProductRagSourceService,
    RagRetrievalService,
    RagCitationResolverService,
  ],
})
export class RagModule {}
