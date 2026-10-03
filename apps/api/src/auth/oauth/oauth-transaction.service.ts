import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";

import { ApiException } from "../../common/api-exception";
import { RedisService } from "../../infrastructure/redis.service";
import type { OAuthProvider } from "./oauth.types";

const TRANSACTION_TTL_SECONDS = 600;

type StoredOAuthTransaction = {
  provider: OAuthProvider;
  nonce: string;
  codeVerifier: string;
  redirectTarget: string;
};

export type OAuthTransactionStart = {
  state: string;
  nonce: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
  redirectTarget: string;
};

@Injectable()
export class OAuthTransactionService {
  constructor(@Inject(RedisService) private readonly redis: RedisService) {}

  async create(
    provider: OAuthProvider,
    requestedRedirect: string | undefined,
  ): Promise<OAuthTransactionStart> {
    const state = randomBytes(32).toString("base64url");
    const nonce = randomBytes(32).toString("base64url");
    const codeVerifier = randomBytes(32).toString("base64url");
    const redirectTarget = this.validateRedirect(requestedRedirect);
    const stored: StoredOAuthTransaction = {
      provider,
      nonce,
      codeVerifier,
      redirectTarget,
    };
    const created = await this.redis.setOnce(
      this.key(state),
      JSON.stringify(stored),
      TRANSACTION_TTL_SECONDS,
    );
    if (!created)
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        "OAUTH_TRANSACTION_UNAVAILABLE",
        "OAuth is temporarily unavailable.",
      );

    return {
      state,
      nonce,
      codeChallenge: createHash("sha256")
        .update(codeVerifier)
        .digest("base64url"),
      codeChallengeMethod: "S256",
      redirectTarget,
    };
  }

  async consume(
    provider: OAuthProvider,
    state: string,
  ): Promise<StoredOAuthTransaction> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(state)) this.invalid();
    const serialized = await this.redis.getAndDelete(this.key(state));
    if (!serialized) this.invalid();

    try {
      const parsed = JSON.parse(serialized) as Partial<StoredOAuthTransaction>;
      if (
        parsed.provider !== provider ||
        typeof parsed.nonce !== "string" ||
        typeof parsed.codeVerifier !== "string" ||
        typeof parsed.redirectTarget !== "string" ||
        this.validateRedirect(parsed.redirectTarget) !== parsed.redirectTarget
      ) {
        this.invalid();
      }
      return parsed as StoredOAuthTransaction;
    } catch (error) {
      if (error instanceof ApiException) throw error;
      return this.invalid();
    }
  }

  validateRedirect(target: string | undefined): string {
    if (!target) return "/account";
    let decoded = target;
    try {
      for (let pass = 0; pass < 2; pass += 1) {
        decoded = decodeURIComponent(decoded);
      }
    } catch {
      return "/account";
    }
    if (!this.isSafeRelativePath(target) || !this.isSafeRelativePath(decoded))
      return "/account";
    const parsed = new URL(target, "https://farta.invalid");
    if (parsed.origin !== "https://farta.invalid") return "/account";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  }

  private isSafeRelativePath(value: string): boolean {
    return (
      value.startsWith("/") &&
      !value.startsWith("//") &&
      !value.includes("\\") &&
      ![...value].some((character) => {
        const code = character.charCodeAt(0);
        return code <= 31 || code === 127;
      })
    );
  }

  private key(state: string): string {
    const digest = createHash("sha256").update(state).digest("hex");
    return `oauth:transaction:${digest}`;
  }

  private invalid(): never {
    throw new ApiException(
      HttpStatus.BAD_REQUEST,
      "OAUTH_TRANSACTION_INVALID",
      "OAuth transaction is invalid or expired.",
    );
  }
}
