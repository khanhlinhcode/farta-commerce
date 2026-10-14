import pino from "pino";
import { describe, expect, it } from "vitest";

import { LOG_REDACTION, logLevelForEnvironment } from "./logging";

describe("structured log redaction", () => {
  it("redacts browser credentials, passwords and infrastructure secrets", () => {
    let output = "";
    const destination = { write: (chunk: string) => (output += chunk) };
    const logger = pino({ redact: LOG_REDACTION }, destination);

    logger.info({
      req: {
        headers: { authorization: "bearer-secret", cookie: "cookie-secret" },
        body: {
          password: "password-secret",
          refreshToken: "refresh-secret",
        },
      },
      config: {
        MONGODB_URI: "mongodb-secret",
        JWT_ACCESS_SECRET: "jwt-secret",
        CSRF_SECRET: "csrf-secret",
        CART_CREDENTIAL_SECRET: "cart-secret",
        ORDER_LOOKUP_SECRET: "lookup-secret",
        GOOGLE_CLIENT_SECRET: "google-secret",
        APPLE_PRIVATE_KEY: "apple-secret",
        SEPAY_WEBHOOK_SECRET: "sepay-webhook-secret",
      },
    });

    for (const secret of [
      "bearer-secret",
      "cookie-secret",
      "password-secret",
      "refresh-secret",
      "mongodb-secret",
      "jwt-secret",
      "csrf-secret",
      "cart-secret",
      "lookup-secret",
      "google-secret",
      "apple-secret",
      "sepay-webhook-secret",
    ]) {
      expect(output).not.toContain(secret);
    }
    expect(output).toContain("[REDACTED]");
  });

  it("uses operational logging in deployed environments", () => {
    expect(logLevelForEnvironment("staging")).toBe("info");
    expect(logLevelForEnvironment("production")).toBe("info");
    expect(logLevelForEnvironment("development")).toBe("debug");
    expect(logLevelForEnvironment("test")).toBe("debug");
  });
});
