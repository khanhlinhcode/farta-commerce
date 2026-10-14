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
  function responseHeaders() {
    const headers: string[] = [];
    const response = {
      append: (_name: string, value: string) => void headers.push(value),
    } as unknown as Response;
    return { headers, response };
  }

  it.each(["staging", "production"] as const)(
    "uses secure protected cookies in %s",
    (appEnvironment) => {
      const service = new AuthCookieService(config(appEnvironment));
      const { headers, response } = responseHeaders();

      service.setCredentials(response, "CUSTOMER", "access", "refresh", "csrf");

      expect(headers[0]).toContain("__Host-farta_customer_access=access");
      expect(headers[0]).toContain("Path=/");
      expect(headers[0]).toContain("HttpOnly");
      expect(headers[0]).toContain("Secure");
      expect(headers[1]).toContain("__Secure-farta_customer_refresh=refresh");
      expect(headers[1]).toContain("Path=/api/v1/auth/customer/refresh");
      expect(headers[1]).toContain("HttpOnly");
      expect(headers[1]).toContain("Secure");
      expect(headers[2]).toContain("__Secure-farta_customer_csrf=csrf");
      expect(headers[2]).toContain("Secure");
      expect(headers[2]).not.toContain("HttpOnly");
      expect(headers.every((header) => !header.includes("Domain="))).toBe(true);
    },
  );

  it("keeps staff and customer cookie realms separate in staging", () => {
    const service = new AuthCookieService(config("staging"));
    const customer = responseHeaders();
    const staff = responseHeaders();
    service.setCredentials(
      customer.response,
      "CUSTOMER",
      "access",
      "refresh",
      "csrf",
    );
    service.setCredentials(
      staff.response,
      "STAFF",
      "access",
      "refresh",
      "csrf",
    );

    expect(customer.headers.join(";")).toContain("farta_customer_");
    expect(customer.headers.join(";")).not.toContain("farta_staff_");
    expect(staff.headers.join(";")).toContain("farta_staff_");
    expect(staff.headers.join(";")).not.toContain("farta_customer_");
  });

  it("clears staging cookies with the issuing security and path attributes", () => {
    const service = new AuthCookieService(config("staging"));
    const { headers, response } = responseHeaders();
    service.clear(response, "CUSTOMER");

    expect(headers[0]).toContain("__Host-farta_customer_access=");
    expect(headers[0]).toContain("Path=/");
    expect(headers[0]).toContain("Secure");
    expect(headers[1]).toContain("__Secure-farta_customer_refresh=");
    expect(headers[1]).toContain("Path=/api/v1/auth/customer/refresh");
    expect(headers[1]).toContain("Secure");
    expect(headers[2]).toContain("__Secure-farta_customer_csrf=");
    expect(headers[2]).toContain("Path=/");
    expect(headers[2]).toContain("Secure");
  });

  it.each(["development", "test"] as const)(
    "keeps local cookie compatibility in %s",
    (appEnvironment) => {
      const service = new AuthCookieService(config(appEnvironment));
      const { headers, response } = responseHeaders();
      service.setCredentials(response, "CUSTOMER", "access", "refresh", "csrf");

      expect(headers[0]).toContain("farta_customer_access=access");
      expect(headers[0]).not.toContain("__Host-");
      expect(headers.every((header) => !header.includes("Secure"))).toBe(true);
    },
  );
});
