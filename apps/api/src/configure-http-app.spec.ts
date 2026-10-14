import { describe, expect, it } from "vitest";

import { httpSecurityOptions } from "./configure-http-app";

describe("HTTP security environment policy", () => {
  it.each(["staging", "production"] as const)(
    "enables explicit deployed headers in %s",
    (appEnvironment) => {
      const options = httpSecurityOptions(appEnvironment);

      expect(options.contentSecurityPolicy).toMatchObject({
        useDefaults: false,
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      });
      expect(options.strictTransportSecurity).toEqual({
        maxAge: 31_536_000,
        includeSubDomains: true,
      });
      expect(options.xContentTypeOptions).toBe(true);
      expect(options.xFrameOptions).toEqual({ action: "deny" });
    },
  );

  it.each(["development", "test"] as const)(
    "keeps CSP and HSTS disabled for local %s",
    (appEnvironment) => {
      const options = httpSecurityOptions(appEnvironment);
      expect(options.contentSecurityPolicy).toBe(false);
      expect(options.strictTransportSecurity).toBe(false);
      expect(options.xContentTypeOptions).toBe(true);
      expect(options.xFrameOptions).toEqual({ action: "deny" });
    },
  );
});
