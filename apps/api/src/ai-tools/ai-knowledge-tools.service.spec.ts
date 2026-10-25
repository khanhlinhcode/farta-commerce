import type { ConfigService } from "@nestjs/config";
import { ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import type { Environment } from "../config/environment";
import type { RagRetrievalService } from "../rag/retrieval/rag-retrieval.service";
import { AiKnowledgeToolsService } from "./ai-knowledge-tools.service";

function config(enabled: boolean): ConfigService<Environment, true> {
  return {
    get: vi.fn().mockReturnValue(enabled),
  } as unknown as ConfigService<Environment, true>;
}

describe("AiKnowledgeToolsService", () => {
  it("maps only authoritative retrieval citations into the signed tool response", async () => {
    const retrieve = vi.fn().mockResolvedValue({
      mode: "LOCAL_DETERMINISTIC_HYBRID",
      query: "chính sách giao hàng",
      hits: [
        {
          score: 0.9,
          lexicalScore: 0.9,
          vectorScore: 0.5,
          citation: {
            citationId: `citation:ragchunk_${"a".repeat(64)}`,
            sourceType: "SHIPPING_POLICY",
            sourceId: "shipping-standard",
            title: "Chính sách giao hàng",
            canonicalPath: "/policies/shipping",
            chunkId: `ragchunk_${"a".repeat(64)}`,
            chunkOrdinal: 0,
            excerpt: "Nội dung giao hàng công khai.",
            sourceVersion: "v1",
            sourceUpdatedAt: "2026-10-25T00:00:00.000Z",
            contentTrust: "UNTRUSTED_PUBLIC_CONTENT",
          },
        },
      ],
    });
    const service = new AiKnowledgeToolsService(config(true), {
      retrieve,
    } as unknown as RagRetrievalService);

    const result = await service.search({
      query: "chính sách giao hàng",
      locale: "vi",
      sourceTypes: ["SHIPPING_POLICY"],
      limit: 3,
    });

    expect(result).toEqual({
      tool: "search_knowledge",
      citations: [expect.objectContaining({ sourceId: "shipping-standard" })],
    });
    expect(retrieve).toHaveBeenCalledWith({
      tenantId: "farta",
      query: "chính sách giao hàng",
      locale: "vi",
      sourceTypes: ["SHIPPING_POLICY"],
      limit: 3,
    });
  });

  it("fails closed without touching retrieval when the local feature is disabled", async () => {
    const retrieve = vi.fn();
    const service = new AiKnowledgeToolsService(config(false), {
      retrieve,
    } as unknown as RagRetrievalService);

    await expect(
      service.search({
        query: "chính sách giao hàng",
        locale: "vi",
        sourceTypes: ["SHIPPING_POLICY"],
        limit: 3,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(retrieve).not.toHaveBeenCalled();
  });
});
