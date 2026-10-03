import type { ConfigService } from "@nestjs/config";
import { describe, expect, it } from "vitest";

import type { Environment } from "../../config/environment";
import { OAuthProviderConfigService } from "./oauth-provider-config.service";

function service(values: Partial<Environment>): OAuthProviderConfigService {
  const config = {
    get: (key: keyof Environment) => values[key],
  } as ConfigService<Environment, true>;
  return new OAuthProviderConfigService(config);
}

describe("OAuthProviderConfigService", () => {
  it("keeps providers disabled when external credentials are absent", () => {
    expect(service({}).statuses()).toEqual([
      { provider: "GOOGLE", enabled: false },
      { provider: "APPLE", enabled: false },
    ]);
  });

  it("reports only completely configured providers as enabled", () => {
    expect(
      service({
        GOOGLE_CLIENT_ID: "client-id",
        GOOGLE_CLIENT_SECRET: "client-secret",
      }).statuses(),
    ).toContainEqual({ provider: "GOOGLE", enabled: true });
  });
});
