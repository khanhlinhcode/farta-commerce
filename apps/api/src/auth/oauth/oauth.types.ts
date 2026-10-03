export const OAUTH_PROVIDERS = ["GOOGLE", "APPLE"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export type VerifiedOAuthIdentity = {
  provider: OAuthProvider;
  subject: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
};

export type OAuthCallbackInput = {
  code: string;
  codeVerifier: string;
  nonce: string;
  redirectUri: string;
};

export interface OAuthProviderAdapter {
  readonly provider: OAuthProvider;
  authorizationUrl(input: {
    state: string;
    nonce: string;
    codeChallenge: string;
    redirectUri: string;
  }): URL;
  exchangeAndVerify(input: OAuthCallbackInput): Promise<VerifiedOAuthIdentity>;
}
