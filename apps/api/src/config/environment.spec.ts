import { describe, expect, it } from "vitest";

import { validateEnvironment } from "./environment";

const valid = {
  APP_ENV: "test",
  PORT: "4000",
  APP_ORIGIN: "http://localhost:3000",
  ADMIN_ORIGIN: "http://localhost:5173",
  API_ORIGIN: "http://localhost:4000",
  MONGODB_URI: "mongodb://localhost/farta",
  REDIS_URL: "redis://localhost:6379/0",
  JWT_ACCESS_SECRET: "a".repeat(32),
  JWT_REFRESH_SECRET: "b".repeat(32),
  JWT_ISSUER: "farta-api",
  JWT_CUSTOMER_AUDIENCE: "farta-storefront",
  JWT_STAFF_AUDIENCE: "farta-admin",
};

describe("environment validation", () => {
  it("parses a valid environment", () =>
    expect(validateEnvironment(valid).PORT).toBe(4000));
  it("rejects missing required configuration without echoing values", () => {
    expect(() => validateEnvironment({ ...valid, MONGODB_URI: "" })).toThrow(
      "MONGODB_URI",
    );
  });
  it("rejects insecure production origins and placeholder secrets", () => {
    expect(() =>
      validateEnvironment({
        ...valid,
        APP_ENV: "production",
        JWT_ACCESS_SECRET: "replace".repeat(6),
      }),
    ).toThrow("APP_ORIGIN");
  });
});
