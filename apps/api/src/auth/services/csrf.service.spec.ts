import { ForbiddenException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { Request } from "express";
import { describe, expect, it } from "vitest";

import type { Environment } from "../../config/environment";
import { AuthCookieService } from "./cookie.service";
import { CsrfService } from "./csrf.service";

const values: Partial<Environment> = {
  APP_ENV: "test",
  APP_ORIGIN: "http://localhost:3000",
  ADMIN_ORIGIN: "http://localhost:5173",
  JWT_ACCESS_TTL_SECONDS: 300,
  SESSION_ABSOLUTE_TTL_SECONDS: 2_592_000,
  CSRF_SECRET: "c".repeat(32),
};
const config = {
  get: (key: keyof Environment) => values[key],
} as ConfigService<Environment, true>;

function request(token: string, origin = "http://localhost:3000"): Request {
  const headers: Record<string, string> = {
    origin,
    "x-csrf-token": token,
    cookie: `farta_customer_csrf=${encodeURIComponent(token)}`,
  };
  return {
    headers,
    header: (name: string) => headers[name.toLowerCase()],
  } as unknown as Request;
}

describe("CsrfService", () => {
  const cookies = new AuthCookieService(config);
  const service = new CsrfService(config, cookies);

  it("accepts a same-origin double-submit token bound to its transaction", () => {
    const token = service.issue("preauth:CUSTOMER");
    expect(() =>
      service.verifyRequest(request(token), "CUSTOMER", "preauth:CUSTOMER"),
    ).not.toThrow();
  });

  it("rejects cross-origin and cross-binding requests", () => {
    const token = service.issue("preauth:CUSTOMER");
    expect(() =>
      service.verifyRequest(
        request(token, "https://attacker.example"),
        "CUSTOMER",
        "preauth:CUSTOMER",
      ),
    ).toThrow(ForbiddenException);
    expect(() =>
      service.verifyRequest(request(token), "CUSTOMER", "session:other"),
    ).toThrow(ForbiddenException);
  });
});
