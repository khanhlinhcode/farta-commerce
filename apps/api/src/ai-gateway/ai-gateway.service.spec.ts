import type { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AiToolsService } from "../ai-tools/ai-tools.service";
import type { Environment } from "../config/environment";
import type { RagCitationResolverService } from "../rag/retrieval/rag-citation-resolver.service";
import type { AiConversationCredentialService } from "./ai-conversation-credential.service";
import type { AiConversationService } from "./ai-conversation.service";
import { AiGatewayService } from "./ai-gateway.service";

const conversationId = "00000000-0000-4000-8000-000000000001";
const citationId = `citation:ragchunk_${"a".repeat(64)}`;

function service(resolveActive: ReturnType<typeof vi.fn>): AiGatewayService {
  const values = {
    AI_ENABLED: true,
    AI_SERVICE_URL: "http://ai.local",
    AI_GATEWAY_SHARED_SECRET: "g".repeat(32),
    AI_REQUEST_TIMEOUT_MS: 1_000,
  };
  const config = {
    get: vi.fn((key: keyof typeof values) => values[key]),
  } as unknown as ConfigService<Environment, true>;
  const credentials = {
    ownerReference: vi.fn().mockReturnValue("guest:test"),
  } as unknown as AiConversationCredentialService;
  const conversations = {
    loadOrCreate: vi.fn().mockResolvedValue({
      id: conversationId,
      owner: "a".repeat(64),
      turns: [],
      selectedProductSlugs: [],
    }),
    save: vi.fn().mockResolvedValue(undefined),
  } as unknown as AiConversationService;
  const tools = { details: vi.fn() } as unknown as AiToolsService;
  const citations = { resolveActive } as unknown as RagCitationResolverService;
  return new AiGatewayService(
    config,
    credentials,
    conversations,
    tools,
    citations,
  );
}

describe("AiGatewayService citation boundary", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("replaces all model-supplied citation metadata with active API records", async () => {
    const resolveActive = vi.fn().mockResolvedValue([
      {
        citationId,
        sourceType: "SHIPPING_POLICY",
        sourceId: "shipping-authoritative",
        title: "Chính sách giao hàng đã xác thực",
        canonicalPath: "/policies/shipping",
        chunkId: `ragchunk_${"a".repeat(64)}`,
        chunkOrdinal: 0,
        excerpt: "Nội dung lấy lại từ bản ghi ACTIVE/PUBLIC.",
        sourceVersion: "shipping-v2",
        sourceUpdatedAt: "2026-10-25T00:00:00.000Z",
        contentTrust: "UNTRUSTED_PUBLIC_CONTENT",
      },
    ]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            requestId: "request-12345678",
            conversationId,
            status: "completed",
            route: "agent",
            message: "Xem nguồn tham khảo.",
            products: [],
            citations: [
              {
                citationId,
                title: "MODEL FABRICATED TITLE",
                canonicalPath: "https://unsafe.example",
              },
            ],
            error: null,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    const result = await service(resolveActive).chat(
      "Chính sách giao hàng?",
      conversationId,
      { id: "request-12345678" } as Request,
      {} as Response,
    );

    expect(resolveActive).toHaveBeenCalledWith("farta", [citationId]);
    expect(result.citations).toEqual([
      {
        citationId,
        sourceType: "SHIPPING_POLICY",
        sourceId: "shipping-authoritative",
        title: "Chính sách giao hàng đã xác thực",
        canonicalPath: "/policies/shipping",
        excerpt: "Nội dung lấy lại từ bản ghi ACTIVE/PUBLIC.",
        sourceVersion: "shipping-v2",
        sourceUpdatedAt: "2026-10-25T00:00:00.000Z",
      },
    ]);
  });

  it("fails closed when a citation is no longer ACTIVE/PUBLIC", async () => {
    const resolveActive = vi.fn().mockResolvedValue([]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            requestId: "request-12345678",
            conversationId,
            status: "completed",
            route: "agent",
            message: "Xem nguồn tham khảo.",
            products: [],
            citations: [{ citationId }],
            error: null,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    await expect(
      service(resolveActive).chat(
        "Chính sách giao hàng?",
        conversationId,
        { id: "request-12345678" } as Request,
        {} as Response,
      ),
    ).rejects.toMatchObject({
      response: { code: "AI_CITATION_STALE" },
    });
  });
});
