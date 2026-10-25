import type { Model } from "mongoose";
import { describe, expect, it, vi } from "vitest";

import type { CategoryDocument } from "../categories/schemas/category.schema";
import type { ProductDocument } from "../products/schemas/product.schema";
import { DeterministicEmbeddingProvider } from "./embedding/deterministic-embedding.provider";
import type { RagEmbeddingProvider } from "./embedding/embedding-provider";
import { StagingNgramEmbeddingProvider } from "./embedding/staging-ngram-embedding.provider";
import { DeterministicRagChunker } from "./ingestion/deterministic-chunker";
import { RagDocumentProjector } from "./ingestion/rag-document-projector";
import { decideRagProjection } from "./rag-knowledge.repository";
import type { RagSourceDocument } from "./rag.types";
import { KnowledgeChunkSchema } from "./schemas/knowledge-chunk.schema";
import { KnowledgeDocumentSchema } from "./schemas/knowledge-document.schema";
import { ProductRagSourceService } from "./sources/product-rag-source.service";

function source(overrides: Partial<RagSourceDocument> = {}): RagSourceDocument {
  return {
    tenantId: "farta",
    sourceType: "PRODUCT",
    sourceId: "farta-essential-tee",
    locale: "vi",
    title: "FARTA Essential Tee",
    canonicalPath: "/product/farta-essential-tee",
    contentSections: [
      "FARTA Essential Tee",
      "Áo cotton phom relaxed, phù hợp để phối hằng ngày.",
    ],
    sourceVersion: "2026-10-25T00:00:00.000Z",
    sourceUpdatedAt: new Date("2026-10-25T00:00:00.000Z"),
    publishedAt: new Date("2026-10-20T00:00:00.000Z"),
    metadata: {
      productSlug: "farta-essential-tee",
      categoryIds: ["category-1"],
      tags: ["Essential", "Cotton"],
    },
    ...overrides,
  };
}

function projector(
  maxCharacters = 1_200,
  embeddings: RagEmbeddingProvider = new DeterministicEmbeddingProvider(),
): RagDocumentProjector {
  return new RagDocumentProjector(
    embeddings,
    new DeterministicRagChunker(maxCharacters),
  );
}

describe("P2-B RAG foundation", () => {
  it("creates deterministic, normalized and bounded embeddings without network access", async () => {
    const provider = new DeterministicEmbeddingProvider();
    const [first, equivalent, different] = await provider.embed([
      "ÁO  COTTON",
      "áo  cotton",
      "đầm midi",
    ]);
    expect(first).toEqual(equivalent);
    expect(first).not.toEqual(different);
    expect(first).toHaveLength(provider.identity.dimensions);
    expect(provider.identity.runtimeScope).toBe("LOCAL_ONLY");
    const magnitude = Math.sqrt(
      (first ?? []).reduce((sum, value) => sum + value * value, 0),
    );
    expect(magnitude).toBeCloseTo(1, 8);
  });

  it("creates accent-insensitive staging vectors without network access", async () => {
    const provider = new StagingNgramEmbeddingProvider();
    const [accented, plain, related, unrelated] = await provider.embed([
      "Áo cotton màu đen",
      "ao cotton mau den",
      "áo cotton đen phom rộng",
      "chính sách đổi trả",
    ]);
    const similarity = (left: number[] = [], right: number[] = []) =>
      left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0);
    expect(accented).toEqual(plain);
    expect(accented).toHaveLength(provider.identity.dimensions);
    expect(provider.identity.runtimeScope).toBe("STAGING_APPROVED");
    expect(similarity(accented, related)).toBeGreaterThan(
      similarity(accented, unrelated),
    );
    expect(
      Math.sqrt(
        (accented ?? []).reduce((sum, value) => sum + value * value, 0),
      ),
    ).toBeCloseTo(1, 8);
  });

  it("chunks deterministically without exceeding the configured boundary", () => {
    const chunker = new DeterministicRagChunker(200);
    const content = [
      "Đoạn đầu mô tả sản phẩm ".repeat(6),
      "Đoạn sau trình bày cách phối đồ ".repeat(8),
    ].join("\n\n");
    const first = chunker.chunk(content);
    expect(first).toEqual(chunker.chunk(content));
    expect(first.length).toBeGreaterThan(1);
    expect(first.every((chunk) => chunk.content.length <= 200)).toBe(true);
    expect(first.map((chunk) => chunk.ordinal)).toEqual(
      first.map((_, index) => index),
    );
  });

  it("projects a stable public document and versioned chunks", async () => {
    const first = await projector().project(source());
    const second = await projector().project(source());
    expect(first).toEqual(second);
    expect(first.document.documentId).toMatch(/^ragdoc_[a-f0-9]{64}$/);
    expect(first.document.status).toBe("ACTIVE");
    expect(first.document.audience).toBe("PUBLIC");
    expect(first.document.metadata.tags).toEqual(["cotton", "essential"]);
    expect(first.chunks).toHaveLength(1);
    expect(first.chunks[0]?.chunkId).toMatch(/^ragchunk_[a-f0-9]{64}$/);
    expect(first.chunks[0]?.embedding).toHaveLength(32);
  });

  it.each([
    "Liên hệ support@example.com để được hỗ trợ.",
    "Gọi số 0901234567 để nhận tư vấn.",
    "api_key=do-not-index-this-value",
    "<script>alert('unsafe')</script>",
  ])(
    "rejects non-public or unsafe corpus content without echoing it",
    async (content) => {
      await expect(
        projector().project(source({ contentSections: [content] })),
      ).rejects.toThrow(/^RAG_PUBLIC_CONTENT_REJECTED:/);
    },
  );

  it("distinguishes idempotent, repair, replacement, stale and conflicting writes", async () => {
    const first = await projector().project(source());
    const active = {
      status: "ACTIVE" as const,
      sourceVersion: first.document.sourceVersion,
      contentHash: first.document.contentHash,
      sourceUpdatedAt: first.document.sourceUpdatedAt,
      schemaVersion: first.document.schemaVersion,
      indexVersion: first.document.indexVersion,
      chunks: first.chunks.map((chunk) => ({
        chunkId: chunk.chunkId,
        schemaVersion: chunk.schemaVersion,
        indexVersion: chunk.indexVersion,
        embeddingModel: chunk.embeddingModel,
        embeddingVersion: chunk.embeddingVersion,
        embeddingDimensions: chunk.embeddingDimensions,
      })),
    };
    expect(decideRagProjection(null, first)).toBe("CREATED");
    expect(decideRagProjection(active, first)).toBe("UNCHANGED");
    expect(decideRagProjection({ ...active, chunks: [] }, first)).toBe(
      "REPAIRED",
    );

    const reembedded = await projector(
      1_200,
      new StagingNgramEmbeddingProvider(),
    ).project(source());
    expect(reembedded.chunks.map((chunk) => chunk.chunkId)).toEqual(
      first.chunks.map((chunk) => chunk.chunkId),
    );
    expect(decideRagProjection(active, reembedded)).toBe("REPAIRED");

    const replacement = await projector().project(
      source({
        contentSections: ["Nội dung mô tả đã được cập nhật."],
        sourceVersion: "2026-10-26T00:00:00.000Z",
        sourceUpdatedAt: new Date("2026-10-26T00:00:00.000Z"),
      }),
    );
    expect(decideRagProjection(active, replacement)).toBe("REPLACED");
    expect(
      decideRagProjection(
        {
          ...active,
          sourceUpdatedAt: new Date("2026-10-27T00:00:00.000Z"),
        },
        replacement,
      ),
    ).toBe("STALE");
    expect(
      decideRagProjection({ ...active, status: "TOMBSTONED" }, first),
    ).toBe("STALE");

    const conflict = await projector().project(
      source({
        contentSections: ["Nội dung khác nhưng dùng lại source version."],
      }),
    );
    expect(() => decideRagProjection(active, conflict)).toThrow(
      "RAG_SOURCE_VERSION_CONFLICT",
    );
  });

  it("declares version, active-document and public-filter indexes", () => {
    const documentIndexes = KnowledgeDocumentSchema.indexes().map(
      ([, options]) => options.name,
    );
    const chunkIndexes = KnowledgeChunkSchema.indexes().map(
      ([, options]) => options.name,
    );
    expect(documentIndexes).toEqual(
      expect.arrayContaining([
        "rag_document_version_unique",
        "rag_document_active_unique",
        "rag_document_public_lookup",
      ]),
    );
    expect(chunkIndexes).toEqual(
      expect.arrayContaining([
        "rag_chunk_unique",
        "rag_chunk_document_version_ordinal_unique",
        "rag_chunk_public_filter",
      ]),
    );
  });

  it("projects only stable public product content, never SKU, price or inventory", async () => {
    const product = {
      id: "product-id",
      slug: "farta-essential-tee",
      name: "FARTA Essential Tee",
      shortDescription: "Áo cotton phom relaxed.",
      description: "Thiết kế tối giản cho trang phục hằng ngày.",
      categoryIds: [{ toString: () => "category-id" }],
      tags: ["essential"],
      updatedAt: new Date("2026-10-25T00:00:00.000Z"),
      publishedAt: new Date("2026-10-20T00:00:00.000Z"),
    } as unknown as ProductDocument;
    const category = {
      id: "category-id",
      name: "Áo thun",
      status: "ACTIVE",
      archivedAt: null,
      updatedAt: new Date("2026-10-26T00:00:00.000Z"),
    } as CategoryDocument;
    const productExec = vi.fn().mockResolvedValue([product]);
    const categoryExec = vi.fn().mockResolvedValue([category]);
    const productModel = {
      find: () => ({ sort: () => ({ exec: productExec }) }),
    } as unknown as Model<ProductDocument>;
    const categoryModel = {
      find: () => ({ select: () => ({ exec: categoryExec }) }),
    } as unknown as Model<CategoryDocument>;

    const [result] = await new ProductRagSourceService(
      productModel,
      categoryModel,
    ).listPublicSources();
    expect(result?.contentSections.join(" ")).toContain("Áo thun");
    expect(JSON.stringify(result)).not.toMatch(/sku|stock|inventory|price/i);
    expect(result?.metadata.productSlug).toBe("farta-essential-tee");
    expect(result?.sourceUpdatedAt).toEqual(
      new Date("2026-10-26T00:00:00.000Z"),
    );
    expect(result?.sourceVersion).toMatch(/^rag-product-v1:[a-f0-9]{64}$/);
  });

  it("changes the source version when a referenced category changes", async () => {
    const product = {
      slug: "farta-essential-tee",
      name: "FARTA Essential Tee",
      shortDescription: "Áo cotton phom relaxed.",
      description: null,
      categoryIds: [{ toString: () => "category-id" }],
      tags: [],
      updatedAt: new Date("2026-10-25T00:00:00.000Z"),
      publishedAt: new Date("2026-10-20T00:00:00.000Z"),
    } as unknown as ProductDocument;
    const productModel = {
      find: () => ({
        sort: () => ({ exec: vi.fn().mockResolvedValue([product]) }),
      }),
    } as unknown as Model<ProductDocument>;
    const categories = (name: string, updatedAt: string) =>
      ({
        find: () => ({
          select: () => ({
            exec: vi.fn().mockResolvedValue([
              {
                id: "category-id",
                name,
                status: "ACTIVE",
                archivedAt: null,
                updatedAt: new Date(updatedAt),
              } as CategoryDocument,
            ]),
          }),
        }),
      }) as unknown as Model<CategoryDocument>;

    const [before] = await new ProductRagSourceService(
      productModel,
      categories("Áo thun", "2026-10-25T00:00:00.000Z"),
    ).listPublicSources();
    const [after] = await new ProductRagSourceService(
      productModel,
      categories("Áo cotton", "2026-10-26T00:00:00.000Z"),
    ).listPublicSources();

    expect(after?.sourceVersion).not.toBe(before?.sourceVersion);
    expect(after?.contentSections).toContain("Danh mục: Áo cotton");
    expect(after?.sourceUpdatedAt).toEqual(
      new Date("2026-10-26T00:00:00.000Z"),
    );
  });
});
