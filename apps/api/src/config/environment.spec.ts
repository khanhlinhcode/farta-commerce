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
  CSRF_SECRET: "c".repeat(32),
  CART_CREDENTIAL_SECRET: "d".repeat(32),
  JWT_ISSUER: "farta-api",
  JWT_CUSTOMER_AUDIENCE: "farta-storefront",
  JWT_STAFF_AUDIENCE: "farta-admin",
  CART_MAX_ITEM_QUANTITY: "10",
  GUEST_CART_TTL_SECONDS: "2592000",
  CUSTOMER_CART_TTL_SECONDS: "7776000",
  CART_MUTATION_LIMIT: "120",
  CART_MUTATION_WINDOW_SECONDS: "300",
  CART_MERGE_LIMIT: "20",
  CART_MERGE_WINDOW_SECONDS: "300",
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
  it("rejects partially configured OAuth providers", () => {
    expect(() =>
      validateEnvironment({ ...valid, GOOGLE_CLIENT_ID: "client-id" }),
    ).toThrow("GOOGLE_CLIENT_ID");
    expect(() =>
      validateEnvironment({
        ...valid,
        APPLE_CLIENT_ID: "com.farta.web",
        APPLE_TEAM_ID: "team-id",
      }),
    ).toThrow("APPLE_CLIENT_ID");
  });
});
