import {
  HttpStatus,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AiChatResponse, AiProductReference } from "@farta/types";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { z } from "zod";

import { AiToolsService } from "../ai-tools/ai-tools.service";
import { ApiException } from "../common/api-exception";
import type { Environment } from "../config/environment";
import { AiConversationCredentialService } from "./ai-conversation-credential.service";
import { AiConversationService } from "./ai-conversation.service";

const aiResponseSchema = z
  .object({
    requestId: z.string().min(8).max(128),
    conversationId: z.string().uuid(),
    status: z.enum(["completed", "clarification", "unavailable"]),
    route: z.enum(["deterministic", "agent", "clarification", "unsupported"]),
    message: z.string().min(1).max(2_000),
    products: z
      .array(z.object({ slug: z.string().max(120) }).passthrough())
      .max(12),
    citations: z.array(z.never()).max(0),
    error: z
      .object({ code: z.string().max(80), message: z.string().max(300) })
      .nullable(),
  })
  .strict();

@Injectable()
export class AiGatewayService {
  private readonly enabled: boolean;
  private readonly serviceUrl: string;
  private readonly secret: string;
  private readonly timeoutMs: number;

  constructor(
    @Inject(ConfigService)
    config: ConfigService<Environment, true>,
    @Inject(AiConversationCredentialService)
    private readonly credentials: AiConversationCredentialService,
    @Inject(AiConversationService)
    private readonly conversations: AiConversationService,
    @Inject(AiToolsService) private readonly tools: AiToolsService,
  ) {
    this.enabled = config.get("AI_ENABLED", { infer: true });
    this.serviceUrl = config
      .get("AI_SERVICE_URL", { infer: true })
      .replace(/\/$/, "");
    this.secret = config.get("AI_GATEWAY_SHARED_SECRET", { infer: true });
    this.timeoutMs = config.get("AI_REQUEST_TIMEOUT_MS", { infer: true });
  }

  async chat(
    message: string,
    conversationId: string | null | undefined,
    request: Request,
    response: Response,
  ): Promise<AiChatResponse> {
    if (!this.enabled) {
      return this.unavailable(
        String(request.id),
        conversationId ?? randomUUID(),
        "AI_DISABLED",
        "Trợ lý sản phẩm đang tạm tắt.",
      );
    }
    const owner = this.credentials.ownerReference(request, response);
    const conversation = await this.conversations.loadOrCreate(
      conversationId,
      owner,
    );

    const payload = JSON.stringify({
      requestId: String(request.id),
      conversationId: conversation.id,
      message: message.trim(),
      history: conversation.turns,
      selectedProductSlugs: conversation.selectedProductSlugs,
    });
    const path = "/v1/chat";
    const headers = this.sign("POST", path, payload);
    let parsed: z.infer<typeof aiResponseSchema>;
    try {
      const upstream = await fetch(`${this.serviceUrl}${path}`, {
        method: "POST",
        headers,
        body: payload,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!upstream.ok) throw new Error("AI service rejected the request.");
      parsed = aiResponseSchema.parse(await upstream.json());
    } catch {
      throw new ServiceUnavailableException(
        "AI Product Advisor is unavailable.",
      );
    }
    if (
      parsed.requestId !== String(request.id) ||
      parsed.conversationId !== conversation.id
    ) {
      throw new ApiException(
        HttpStatus.BAD_GATEWAY,
        "AI_RESPONSE_INVALID",
        "AI Product Advisor returned an invalid response.",
      );
    }

    const products = await this.hydrateProducts(
      parsed.products.map((product) => product.slug),
    );
    const result: AiChatResponse = {
      requestId: parsed.requestId,
      conversationId: parsed.conversationId,
      status: parsed.status,
      route: parsed.route,
      message: parsed.message,
      products,
      citations: [],
      error: parsed.error,
    };
    await this.conversations.save(
      conversation,
      message,
      result.message,
      products.map((product) => product.slug),
    );
    return result;
  }

  private async hydrateProducts(
    slugs: readonly string[],
  ): Promise<AiProductReference[]> {
    const unique = [...new Set(slugs)].slice(0, 6);
    const results = await Promise.all(
      unique.map(async (slug) => {
        try {
          return (await this.tools.details(slug)).products[0] ?? null;
        } catch {
          return null;
        }
      }),
    );
    return results.filter((product) => product !== null);
  }

  private sign(
    method: string,
    path: string,
    body: string,
  ): Record<string, string> {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonce = randomBytes(32).toString("base64url");
    const audience = "farta-ai-service";
    const payload = [timestamp, nonce, audience, method, path, body].join(".");
    const signature = createHmac("sha256", this.secret)
      .update(payload)
      .digest("base64url");
    return {
      accept: "application/json",
      "content-type": "application/json",
      "x-farta-ai-timestamp": timestamp,
      "x-farta-ai-nonce": nonce,
      "x-farta-ai-audience": audience,
      "x-farta-ai-signature": signature,
    };
  }

  private unavailable(
    requestId: string,
    conversationId: string,
    code: string,
    message: string,
  ): AiChatResponse {
    return {
      requestId,
      conversationId,
      status: "unavailable",
      route: "unsupported",
      message,
      products: [],
      citations: [],
      error: { code, message },
    };
  }
}
