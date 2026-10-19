import {
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";

import type { Environment } from "../config/environment";
import { RedisService } from "../infrastructure/redis.service";

const conversationSchema = z.object({
  owner: z.string().length(64),
  turns: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(1_500),
      }),
    )
    .max(6),
  selectedProductSlugs: z.array(z.string().max(120)).max(6),
});

export type AiConversation = z.infer<typeof conversationSchema> & {
  id: string;
};

@Injectable()
export class AiConversationService {
  private readonly ttlSeconds: number;

  constructor(
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(ConfigService)
    config: ConfigService<Environment, true>,
  ) {
    this.ttlSeconds = config.get("AI_CONVERSATION_TTL_SECONDS", {
      infer: true,
    });
  }

  async loadOrCreate(
    conversationId: string | null | undefined,
    ownerReference: string,
  ): Promise<AiConversation> {
    const owner = this.ownerDigest(ownerReference);
    if (!conversationId) {
      return { id: randomUUID(), owner, turns: [], selectedProductSlugs: [] };
    }
    try {
      const stored = await this.redis.get(this.key(conversationId));
      if (!stored) throw new NotFoundException("Conversation was not found.");
      const parsed = conversationSchema.safeParse(JSON.parse(stored));
      if (!parsed.success || parsed.data.owner !== owner) {
        throw new NotFoundException("Conversation was not found.");
      }
      return { id: conversationId, ...parsed.data };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new ServiceUnavailableException(
        "Conversation storage is unavailable.",
      );
    }
  }

  async save(
    conversation: AiConversation,
    userMessage: string,
    assistantMessage: string,
    productSlugs: readonly string[],
  ): Promise<void> {
    const turns = [
      ...conversation.turns,
      { role: "user" as const, content: userMessage },
      { role: "assistant" as const, content: assistantMessage },
    ].slice(-6);
    const value = conversationSchema.parse({
      owner: conversation.owner,
      turns,
      selectedProductSlugs: [...new Set(productSlugs)].slice(0, 6),
    });
    try {
      await this.redis.set(
        this.key(conversation.id),
        JSON.stringify(value),
        this.ttlSeconds,
      );
    } catch {
      throw new ServiceUnavailableException(
        "Conversation storage is unavailable.",
      );
    }
  }

  private key(conversationId: string): string {
    return `ai:conversation:${conversationId}`;
  }

  private ownerDigest(ownerReference: string): string {
    return createHash("sha256").update(ownerReference).digest("hex");
  }
}
