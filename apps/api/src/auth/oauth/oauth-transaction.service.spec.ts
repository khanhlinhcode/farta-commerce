import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import type { RedisService } from "../../infrastructure/redis.service";
import { OAuthTransactionService } from "./oauth-transaction.service";

function createHarness() {
  const values = new Map<string, string>();
  const redis = {
    setOnce: vi.fn(async (key: string, value: string) => {
      if (values.has(key)) return false;
      values.set(key, value);
      return true;
    }),
    getAndDelete: vi.fn(async (key: string) => {
      const value = values.get(key) ?? null;
      values.delete(key);
      return value;
    }),
  } as unknown as RedisService;
  return { service: new OAuthTransactionService(redis), redis };
}

describe("OAuthTransactionService", () => {
  it("creates S256 state/nonce/PKCE material and consumes it once", async () => {
    const { service, redis } = createHarness();
    const started = await service.create("GOOGLE", "/account?from=oauth");
    const serialized = vi.mocked(redis.setOnce).mock.calls[0]?.[1];
    const stored = JSON.parse(serialized ?? "{}") as {
      codeVerifier: string;
    };

    expect(started.state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(started.nonce).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(started.codeChallengeMethod).toBe("S256");
    expect(started.codeChallenge).toBe(
      createHash("sha256").update(stored.codeVerifier).digest("base64url"),
    );
    await expect(
      service.consume("GOOGLE", started.state),
    ).resolves.toMatchObject({
      provider: "GOOGLE",
      nonce: started.nonce,
      redirectTarget: "/account?from=oauth",
    });
    await expect(
      service.consume("GOOGLE", started.state),
    ).rejects.toMatchObject({
      response: { code: "OAUTH_TRANSACTION_INVALID" },
    });
  });

  it("rejects provider substitution and unsafe redirect targets", async () => {
    const { service } = createHarness();
    expect(service.validateRedirect("https://attacker.example")).toBe(
      "/account",
    );
    expect(service.validateRedirect("//attacker.example/path")).toBe(
      "/account",
    );
    expect(service.validateRedirect("/\\attacker.example")).toBe("/account");
    expect(service.validateRedirect("/%2f%2fattacker.example")).toBe(
      "/account",
    );

    const started = await service.create("APPLE", "/account/security");
    await expect(
      service.consume("GOOGLE", started.state),
    ).rejects.toMatchObject({
      response: { code: "OAUTH_TRANSACTION_INVALID" },
    });
  });
});
