import pino from "pino";
import { describe, expect, it } from "vitest";

import { LOG_REDACTION } from "./logging";

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
      "sepay-webhook-secret",
    ]) {
      expect(output).not.toContain(secret);
    }
    expect(output).toContain("[REDACTED]");
  });
});
