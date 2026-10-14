import type { ConfigService } from "@nestjs/config";
import type { Response } from "express";
import { describe, expect, it } from "vitest";

import type { Environment } from "../config/environment";
import { CartCredentialService } from "./cart-credential.service";

function config(
  appEnv: Environment["APP_ENV"],
): ConfigService<Environment, true> {
  const values: Partial<Environment> = {
    APP_ENV: appEnv,
    CART_CREDENTIAL_SECRET: "c".repeat(32),
    GUEST_CART_TTL_SECONDS: 2_592_000,
  };
  return { get: (key: keyof Environment) => values[key] } as ConfigService<
    Environment,
    true
  >;
}

function responseHeaders() {
  const headers: string[] = [];
  const response = {
    append: (_name: string, value: string) => void headers.push(value),
  } as unknown as Response;
  return { headers, response };
}

describe("CartCredentialService", () => {
  it.each(["staging", "production"] as const)(
    "uses a secure host-only cookie in %s",
    (appEnvironment) => {
      const service = new CartCredentialService(config(appEnvironment));
      const issued = responseHeaders();
      service.issue(issued.response);

      expect(issued.headers[0]).toContain("__Host-farta_guest_cart=");
      expect(issued.headers[0]).toContain("HttpOnly");
      expect(issued.headers[0]).toContain("Secure");
      expect(issued.headers[0]).toContain("SameSite=Lax");
      expect(issued.headers[0]).toContain("Path=/");
      expect(issued.headers[0]).not.toContain("Domain=");

      const cleared = responseHeaders();
      service.clear(cleared.response);
      expect(cleared.headers[0]).toContain("__Host-farta_guest_cart=");
      expect(cleared.headers[0]).toContain("Max-Age=0");
      expect(cleared.headers[0]).toContain("Secure");
      expect(cleared.headers[0]).toContain("Path=/");
    },
  );

  it.each(["development", "test"] as const)(
    "keeps local guest-cart compatibility in %s",
    (appEnvironment) => {
      const service = new CartCredentialService(config(appEnvironment));
      const { headers, response } = responseHeaders();
      service.issue(response);

      expect(headers[0]).toContain("farta_guest_cart=");
      expect(headers[0]).not.toContain("__Host-");
      expect(headers[0]).not.toContain("Secure");
    },
  );
});
