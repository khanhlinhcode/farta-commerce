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
  CHECKOUT_RESERVATION_TTL_SECONDS: "900",
  SHIPPING_FLAT_FEE_VND: "30000",
  FREE_SHIPPING_THRESHOLD_VND: "1000000",
  ORDER_LOOKUP_SECRET: "e".repeat(32),
  CHECKOUT_LIMIT: "20",
  CHECKOUT_WINDOW_SECONDS: "300",
  ORDER_LOOKUP_LIMIT: "10",
  ORDER_LOOKUP_WINDOW_SECONDS: "300",
};

const validStaging = {
  ...valid,
  APP_ENV: "staging",
  APP_ORIGIN: "https://storefront.staging.example",
  ADMIN_ORIGIN: "https://admin.staging.example",
  API_ORIGIN: "https://api.staging.example",
};

describe("environment validation", () => {
  it("parses a valid environment", () =>
    expect(validateEnvironment(valid)).toMatchObject({
      PORT: 4000,
      TRUST_PROXY_HOPS: 0,
      PAYMENT_INITIATE_LIMIT: 20,
      PAYMENT_INITIATE_GLOBAL_LIMIT: 100,
      PAYMENT_STATUS_LIMIT: 120,
      PAYMENT_STATUS_GLOBAL_LIMIT: 600,
      RESERVATION_WORKER_INTERVAL_MS: 15_000,
      RESERVATION_WORKER_BATCH_SIZE: 50,
      SEPAY_ENABLED: false,
      SEPAY_DEPOSIT_MODE: "DISABLED",
    }));
  it("accepts a complete SePay configuration and rejects incomplete setup", () => {
    expect(
      validateEnvironment({
        ...valid,
        SEPAY_ENABLED: "true",
        SEPAY_BANK_NAME: "TestBank",
        SEPAY_ACCOUNT_NUMBER: "0123456789",
        SEPAY_ACCOUNT_HOLDER: "FARTA TEST",
        SEPAY_WEBHOOK_SECRET: "s".repeat(32),
        SEPAY_DEPOSIT_MODE: "FIXED",
        SEPAY_DEPOSIT_FIXED_VND: "100000",
      }),
    ).toMatchObject({ SEPAY_ENABLED: true, SEPAY_DEPOSIT_FIXED_VND: 100000 });
    expect(() =>
      validateEnvironment({ ...valid, SEPAY_ENABLED: "true" }),
    ).toThrow("SEPAY_BANK_NAME");
    expect(() =>
      validateEnvironment({
        ...valid,
        SEPAY_DEPOSIT_MODE: "PERCENTAGE",
        SEPAY_DEPOSIT_BASIS_POINTS: "3000",
      }),
    ).toThrow("SEPAY_DEPOSIT_MODE");
  });
  it("rejects missing required configuration without echoing values", () => {
    expect(() => validateEnvironment({ ...valid, MONGODB_URI: "" })).toThrow(
      "MONGODB_URI",
    );
  });
  it.each(["APP_ORIGIN", "ADMIN_ORIGIN", "API_ORIGIN"] as const)(
    "rejects an insecure staging %s",
    (key) => {
      expect(() =>
        validateEnvironment({
          ...validStaging,
          [key]: "http://staging.example",
        }),
      ).toThrow(key);
    },
  );
  it("accepts HTTPS staging origins while SePay is disabled", () => {
    expect(validateEnvironment(validStaging)).toMatchObject({
      APP_ENV: "staging",
      SEPAY_ENABLED: false,
      SEPAY_WEBHOOK_SECRET: "",
    });
  });
  it("requires complete AI secrets and HTTPS service URL when enabled", () => {
    expect(() => validateEnvironment({ ...valid, AI_ENABLED: "true" })).toThrow(
      "AI_GATEWAY_SHARED_SECRET",
    );
    const ai = {
      ...valid,
      AI_ENABLED: "true",
      AI_GATEWAY_SHARED_SECRET: "g".repeat(32),
      AI_TOOLS_SHARED_SECRET: "t".repeat(32),
      AI_CONVERSATION_SECRET: "c".repeat(32),
    };
    expect(validateEnvironment(ai)).toMatchObject({ AI_ENABLED: true });
    expect(() =>
      validateEnvironment({
        ...validStaging,
        ...ai,
        APP_ENV: "staging",
        APP_ORIGIN: validStaging.APP_ORIGIN,
        ADMIN_ORIGIN: validStaging.ADMIN_ORIGIN,
        API_ORIGIN: validStaging.API_ORIGIN,
        AI_SERVICE_URL: "http://ai.internal",
      }),
    ).toThrow("AI_SERVICE_URL");
  });
  it("allows only an explicit single-label private HTTP AI host in staging", () => {
    const enabledAi = {
      ...validStaging,
      AI_ENABLED: "true",
      AI_GATEWAY_SHARED_SECRET: "g".repeat(32),
      AI_TOOLS_SHARED_SECRET: "t".repeat(32),
      AI_CONVERSATION_SECRET: "c".repeat(32),
      AI_ALLOW_STAGING_PRIVATE_HTTP: "true",
    };
    expect(
      validateEnvironment({
        ...enabledAi,
        AI_SERVICE_URL: "http://farta-ai:8000",
      }),
    ).toMatchObject({
      APP_ENV: "staging",
      AI_ENABLED: true,
      AI_ALLOW_STAGING_PRIVATE_HTTP: true,
    });
    for (const unsafeUrl of [
      "http://localhost:8000",
      "http://127.0.0.1:8000",
      "http://ai.internal:8000",
      "http://user:password@farta-ai:8000",
    ]) {
      expect(() =>
        validateEnvironment({ ...enabledAi, AI_SERVICE_URL: unsafeUrl }),
      ).toThrow("AI_SERVICE_URL");
    }
    expect(() =>
      validateEnvironment({
        ...enabledAi,
        APP_ENV: "production",
        AI_SERVICE_URL: "http://farta-ai:8000",
      }),
    ).toThrow("AI_SERVICE_URL");
  });
  it("rejects staging placeholder secrets without echoing their values", () => {
    const placeholder = "replace-with-a-secret-that-must-not-be-logged";
    let message = "";
    try {
      validateEnvironment({
        ...validStaging,
        JWT_ACCESS_SECRET: placeholder,
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain("JWT_ACCESS_SECRET");
    expect(message).not.toContain(placeholder);
  });
  it.each([
    "BOOTSTRAP_OWNER_EMAIL",
    "BOOTSTRAP_OWNER_PASSWORD",
    "BOOTSTRAP_OWNER_DISPLAY_NAME",
  ] as const)("rejects staging development value %s", (key) => {
    expect(() =>
      validateEnvironment({ ...validStaging, [key]: "development-only" }),
    ).toThrow(key);
  });
  it("preserves local HTTP for development and test", () => {
    expect(validateEnvironment(valid)).toMatchObject({ APP_ENV: "test" });
    expect(
      validateEnvironment({ ...valid, APP_ENV: "development" }),
    ).toMatchObject({ APP_ENV: "development" });
  });
  it("rejects insecure production origins and placeholder secrets", () => {
    expect(() =>
      validateEnvironment({
        ...validStaging,
        APP_ENV: "production",
        APP_ORIGIN: "http://storefront.example",
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
