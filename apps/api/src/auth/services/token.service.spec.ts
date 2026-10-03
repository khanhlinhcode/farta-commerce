import { UnauthorizedException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";

import type { Environment } from "../../config/environment";
import { TokenService } from "./token.service";

const values: Partial<Environment> = {
  JWT_ACCESS_SECRET: "a".repeat(32),
  JWT_REFRESH_SECRET: "b".repeat(32),
  JWT_ISSUER: "farta-api",
  JWT_CUSTOMER_AUDIENCE: "farta-storefront",
  JWT_STAFF_AUDIENCE: "farta-admin",
  JWT_ACCESS_TTL_SECONDS: 300,
};

const config = {
  get: (key: keyof Environment) => values[key],
} as ConfigService<Environment, true>;

describe("TokenService", () => {
  const service = new TokenService(config);
  const claims = {
    userId: "507f1f77bcf86cd799439011",
    sessionId: "507f1f77bcf86cd799439012",
    realm: "CUSTOMER" as const,
    rolesVersion: 1,
  };

  it("issues and cryptographically verifies minimal access claims", async () => {
    const token = await service.issueAccessToken(claims);

    await expect(service.verifyAccessToken(token, "CUSTOMER")).resolves.toEqual(
      claims,
    );
  });

  it("rejects cross-realm use and token tampering", async () => {
    const token = await service.issueAccessToken(claims);
    const [header, payload, signature] = token.split(".");
    const tamperedPayload = `${payload?.slice(0, -2)}${payload?.endsWith("aa") ? "bb" : "aa"}`;
    const tampered = `${header}.${tamperedPayload}.${signature}`;

    await expect(
      service.verifyAccessToken(token, "STAFF"),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      service.verifyAccessToken(tampered, "CUSTOMER"),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects an expired access token", async () => {
    const expired = await new SignJWT({
      sid: claims.sessionId,
      realm: claims.realm,
      rolesVersion: claims.rolesVersion,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(claims.userId)
      .setIssuer("farta-api")
      .setAudience("farta-storefront")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 120)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode("a".repeat(32)));

    await expect(
      service.verifyAccessToken(expired, "CUSTOMER"),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("creates opaque refresh credentials and stores only a stable digest", () => {
    const first = service.createRefreshCredential(claims.sessionId);
    const second = service.createRefreshCredential(claims.sessionId);
    const parsed = service.parseRefreshCredential(first.raw);

    expect(first.raw).not.toContain(first.digest);
    expect(first.raw).not.toBe(second.raw);
    expect(parsed.sessionId).toBe(claims.sessionId);
    expect(service.digestsEqual(parsed.digest, first.digest)).toBe(true);
    expect(service.digestsEqual(first.digest, second.digest)).toBe(false);
  });
});
