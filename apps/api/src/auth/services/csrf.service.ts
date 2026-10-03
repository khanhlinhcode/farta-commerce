import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request } from "express";

import type { Environment } from "../../config/environment";
import type { AuthRealm } from "../auth.constants";
import { AuthCookieService } from "./cookie.service";

@Injectable()
export class CsrfService {
  private readonly secret: string;
  private readonly origins: ReadonlySet<string>;

  constructor(
    @Inject(ConfigService) config: ConfigService<Environment, true>,
    @Inject(AuthCookieService) private readonly cookies: AuthCookieService,
  ) {
    this.secret = config.get("CSRF_SECRET", { infer: true });
    this.origins = new Set([
      new URL(config.get("APP_ORIGIN", { infer: true })).origin,
      new URL(config.get("ADMIN_ORIGIN", { infer: true })).origin,
    ]);
  }

  issue(binding: string, ttlSeconds = 3600): string {
    const nonce = randomBytes(24).toString("base64url");
    const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
    const payload = `${nonce}.${expires}.${binding}`;
    return `${payload}.${this.sign(payload)}`;
  }

  verifyRequest(request: Request, realm: AuthRealm, binding: string): void {
    this.verifyOrigin(request);
    const header = request.header("x-csrf-token");
    const cookie = this.cookies.read(request, "csrf", realm);
    if (!header || !cookie || !this.safeEqual(header, cookie)) this.reject();
    this.verifyToken(header, binding);
  }

  private verifyToken(token: string, binding: string): void {
    const parts = token.split(".");
    if (parts.length !== 4) this.reject();
    const [nonce, expiresRaw, tokenBinding, signature] = parts;
    if (!nonce || !expiresRaw || !tokenBinding || !signature) this.reject();
    const expires = Number(expiresRaw);
    if (
      !Number.isSafeInteger(expires) ||
      expires <= Math.floor(Date.now() / 1000)
    )
      this.reject();
    if (!this.safeEqual(tokenBinding, binding)) this.reject();
    const payload = `${nonce}.${expiresRaw}.${tokenBinding}`;
    if (!this.safeEqual(signature, this.sign(payload))) this.reject();
  }

  private verifyOrigin(request: Request): void {
    const origin = request.header("origin");
    if (origin) {
      if (!this.origins.has(origin)) this.reject();
      return;
    }
    const referer = request.header("referer");
    if (!referer) this.reject();
    try {
      if (!this.origins.has(new URL(referer).origin)) this.reject();
    } catch {
      this.reject();
    }
  }

  private sign(payload: string): string {
    return createHmac("sha256", this.secret)
      .update(payload)
      .digest("base64url");
  }

  private safeEqual(left: string, right: string): boolean {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private reject(): never {
    throw new ForbiddenException("CSRF validation failed.");
  }
}
