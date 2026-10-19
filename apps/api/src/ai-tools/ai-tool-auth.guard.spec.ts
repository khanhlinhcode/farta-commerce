import type { ExecutionContext } from "@nestjs/common";
import { UnauthorizedException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import type { Environment } from "../config/environment";
import type { RedisService } from "../infrastructure/redis.service";
import { AiToolAuthGuard } from "./ai-tool-auth.guard";

const secret = "t".repeat(32);

function fixture(replayAccepted = true) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = "n".repeat(32);
  const audience = "farta-ai-tools";
  const method = "POST";
  const originalUrl = "/api/v1/internal/ai/tools/search-products";
  const rawBody = Buffer.from('{"limit":6}');
  const signature = createHmac("sha256", secret)
    .update(
      [
        timestamp,
        nonce,
        audience,
        method,
        originalUrl,
        rawBody.toString(),
      ].join("."),
    )
    .digest("base64url");
  const request = {
    method,
    originalUrl,
    rawBody,
    headers: {
      "x-farta-ai-timestamp": timestamp,
      "x-farta-ai-nonce": nonce,
      "x-farta-ai-audience": audience,
      "x-farta-ai-signature": signature,
    },
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  const config = {
    get: (key: keyof Environment) =>
      key === "AI_TOOLS_SHARED_SECRET" ? secret : 60,
  } as unknown as ConfigService<Environment, true>;
  const redis = {
    setOnce: vi.fn().mockResolvedValue(replayAccepted),
  } as unknown as RedisService;
  return { guard: new AiToolAuthGuard(config, redis), context };
}

describe("AiToolAuthGuard", () => {
  it("accepts one correctly signed internal request", async () => {
    const { guard, context } = fixture();
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("rejects a replayed nonce", async () => {
    const { guard, context } = fixture(false);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
