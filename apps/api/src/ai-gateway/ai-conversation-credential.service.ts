import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { parse, serialize } from "cookie";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";

import { isDeployedEnvironment, type Environment } from "../config/environment";

@Injectable()
export class AiConversationCredentialService {
  private readonly secret: string;
  private readonly deployed: boolean;
  private readonly ttlSeconds: number;

  constructor(@Inject(ConfigService) config: ConfigService<Environment, true>) {
    this.secret = config.get("AI_CONVERSATION_SECRET", { infer: true });
    this.deployed = isDeployedEnvironment(
      config.get("APP_ENV", { infer: true }),
    );
    this.ttlSeconds = config.get("AI_CONVERSATION_TTL_SECONDS", {
      infer: true,
    });
  }

  ownerReference(request: Request, response: Response): string {
    if (request.principal) return `customer:${request.principal.sessionId}`;
    const existing = parse(request.headers.cookie ?? "")[this.cookieName()];
    const credential = existing ? this.verify(existing) : this.issue(response);
    return `guest:${this.digest(credential)}`;
  }

  private issue(response: Response): string {
    const nonce = randomBytes(32).toString("base64url");
    const credential = `${nonce}.${this.sign(nonce)}`;
    response.append(
      "Set-Cookie",
      serialize(this.cookieName(), credential, {
        httpOnly: true,
        secure: this.deployed,
        sameSite: "lax",
        path: "/",
        maxAge: this.ttlSeconds,
      }),
    );
    return credential;
  }

  private verify(credential: string): string {
    const [nonce, signature, extra] = credential.split(".");
    if (
      extra !== undefined ||
      !nonce ||
      !signature ||
      !/^[A-Za-z0-9_-]{43}$/.test(nonce) ||
      !this.safeEqual(signature, this.sign(nonce))
    ) {
      throw new UnauthorizedException("AI conversation credential is invalid.");
    }
    return credential;
  }

  private digest(credential: string): string {
    return createHmac("sha256", this.secret).update(credential).digest("hex");
  }

  private sign(nonce: string): string {
    return createHmac("sha256", this.secret)
      .update(`farta-ai-conversation:${nonce}`)
      .digest("base64url");
  }

  private safeEqual(left: string, right: string): boolean {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private cookieName(): string {
    return this.deployed ? "__Host-farta_ai_guest" : "farta_ai_guest";
  }
}
