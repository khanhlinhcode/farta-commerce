import { Inject, Injectable } from "@nestjs/common";

import { RagDocumentProjector } from "./ingestion/rag-document-projector";
import {
  RAG_KNOWLEDGE_REPOSITORY,
  type RagKnowledgeRepository,
} from "./rag-knowledge.repository";
import type {
  RagSourceDocument,
  RagSourceIdentity,
  RagSourceSet,
  RagTombstoneResult,
  RagReconcileResult,
  RagWriteResult,
} from "./rag.types";

@Injectable()
export class RagIngestionService {
  constructor(
    @Inject(RagDocumentProjector)
    private readonly projector: RagDocumentProjector,
    @Inject(RAG_KNOWLEDGE_REPOSITORY)
    private readonly repository: RagKnowledgeRepository,
  ) {}

  async ingest(source: RagSourceDocument): Promise<RagWriteResult> {
    return this.repository.applyProjection(
      await this.projector.project(source),
    );
  }

  async tombstone(identity: RagSourceIdentity): Promise<RagTombstoneResult> {
    return this.repository.tombstone(identity);
  }

  async reconcileCompleteSourceSet(
    sourceSet: RagSourceSet,
  ): Promise<RagReconcileResult> {
    return this.repository.tombstoneMissing(sourceSet);
  }
}
