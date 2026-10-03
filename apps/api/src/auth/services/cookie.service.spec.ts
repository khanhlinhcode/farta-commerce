import type { ConfigService } from "@nestjs/config";
import type { Response } from "express";
import { describe, expect, it } from "vitest";

import type { Environment } from "../../config/environment";
import { AuthCookieService } from "./cookie.service";

function config(
  appEnv: Environment["APP_ENV"],
): ConfigService<Environment, true> {
  const values: Partial<Environment> = {
    APP_ENV: appEnv,
    JWT_ACCESS_TTL_SECONDS: 300,
    SESSION_ABSOLUTE_TTL_SECONDS: 2_592_000,
  };
  return { get: (key: keyof Environment) => values[key] } as ConfigService<
    Environment,
    true
  >;
}

describe("AuthCookieService", () => {
  it("uses secure host-only production cookie prefixes and HttpOnly credentials", () => {
    const service = new AuthCookieService(config("production"));
    const headers: string[] = [];
    const response = {
      append: (_name: string, value: string) => void headers.push(value),
    } as unknown as Response;

    service.setCredentials(response, "CUSTOMER", "access", "refresh", "csrf");

    expect(headers[0]).toContain("__Host-farta_customer_access=access");
    expect(headers[0]).toContain("HttpOnly");
    expect(headers[0]).toContain("Secure");
    expect(headers[1]).toContain("__Secure-farta_customer_refresh=refresh");
    expect(headers[1]).toContain("Path=/api/v1/auth/customer/refresh");
    expect(headers[2]).not.toContain("HttpOnly");
    expect(headers.every((header) => !header.includes("Domain="))).toBe(true);
  });
});
