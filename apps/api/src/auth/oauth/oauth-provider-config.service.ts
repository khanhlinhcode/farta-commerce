import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { Environment } from "../../config/environment";
import type { OAuthProvider } from "./oauth.types";

export type OAuthProviderStatus = {
  provider: OAuthProvider;
  enabled: boolean;
};

@Injectable()
export class OAuthProviderConfigService {
  constructor(
    @Inject(ConfigService)
    private readonly config: ConfigService<Environment, true>,
  ) {}

  statuses(): OAuthProviderStatus[] {
    return [
      {
        provider: "GOOGLE",
        enabled: this.complete(["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]),
      },
      {
        provider: "APPLE",
        enabled: this.complete([
          "APPLE_CLIENT_ID",
          "APPLE_TEAM_ID",
          "APPLE_KEY_ID",
          "APPLE_PRIVATE_KEY",
        ]),
      },
    ];
  }

  private complete(keys: (keyof Environment)[]): boolean {
    return keys.every((key) => Boolean(this.config.get(key, { infer: true })));
  }
}
