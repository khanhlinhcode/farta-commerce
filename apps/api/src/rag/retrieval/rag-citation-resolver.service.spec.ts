import type { Model } from "mongoose";
import { describe, expect, it, vi } from "vitest";

import { StagingNgramEmbeddingProvider } from "../embedding/staging-ngram-embedding.provider";
import { RAG_INDEX_VERSION } from "../rag.constants";
import type { KnowledgeChunkDocument } from "../schemas/knowledge-chunk.schema";
import { RagCitationResolverService } from "./rag-citation-resolver.service";

describe("RagCitationResolverService", () => {
  it("resolves citations only from the current index and embedding identity", async () => {
    const exec = vi.fn().mockResolvedValue([]);
    const lean = vi.fn(() => ({ exec }));
    const select = vi.fn(() => ({ lean }));
    const find = vi.fn(() => ({ select }));
    const embeddings = new StagingNgramEmbeddingProvider();
    const resolver = new RagCitationResolverService(
      { find } as unknown as Model<KnowledgeChunkDocument>,
      embeddings,
    );
    const chunkId = `ragchunk_${"a".repeat(64)}`;

    await resolver.resolveActive("farta", [`citation:${chunkId}`]);

    expect(find).toHaveBeenCalledWith({
      tenantId: "farta",
      chunkId: { $in: [chunkId] },
      audience: "PUBLIC",
      status: "ACTIVE",
      indexVersion: RAG_INDEX_VERSION,
      embeddingModel: embeddings.identity.model,
      embeddingVersion: embeddings.identity.version,
      embeddingDimensions: embeddings.identity.dimensions,
    });
  });
});
