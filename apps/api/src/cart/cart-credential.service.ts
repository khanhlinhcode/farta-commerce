import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { parseCookie, stringifySetCookie } from "cookie";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";

import { isDeployedEnvironment, type Environment } from "../config/environment";

@Injectable()
export class CartCredentialService {
  private readonly secret: string;
  private readonly deployed: boolean;
  private readonly ttlSeconds: number;

  constructor(@Inject(ConfigService) config: ConfigService<Environment, true>) {
    this.secret = config.get("CART_CREDENTIAL_SECRET", { infer: true });
    this.deployed = isDeployedEnvironment(
      config.get("APP_ENV", { infer: true }),
    );
    this.ttlSeconds = config.get("GUEST_CART_TTL_SECONDS", { infer: true });
  }

  read(request: Request): string | undefined {
    const raw = parseCookie(request.headers.cookie ?? "")[this.cookieName()];
    if (!raw) return undefined;
    const [nonce, signature, extra] = raw.split(".");
    if (
      extra !== undefined ||
      !nonce ||
      !signature ||
      !/^[A-Za-z0-9_-]{43}$/.test(nonce) ||
      !this.safeEqual(signature, this.sign(nonce))
    ) {
      throw new UnauthorizedException("Guest cart credential is invalid.");
    }
    return raw;
  }

  issue(response: Response): string {
    const nonce = randomBytes(32).toString("base64url");
    const raw = `${nonce}.${this.sign(nonce)}`;
    response.append(
      "Set-Cookie",
      stringifySetCookie({
        name: this.cookieName(),
        value: raw,
        httpOnly: true,
        secure: this.deployed,
        sameSite: "lax",
        path: "/",
        maxAge: this.ttlSeconds,
      }),
    );
    return raw;
  }

  clear(response: Response): void {
    response.append(
      "Set-Cookie",
      stringifySetCookie({
        name: this.cookieName(),
        value: "",
        httpOnly: true,
        secure: this.deployed,
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      }),
    );
  }

  digest(raw: string): string {
    return createHmac("sha256", this.secret).update(raw).digest("hex");
  }

  private sign(nonce: string): string {
    return createHmac("sha256", this.secret)
      .update(`farta-cart:${nonce}`)
      .digest("base64url");
  }

  private safeEqual(left: string, right: string): boolean {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private cookieName(): string {
    return this.deployed ? "__Host-farta_guest_cart" : "farta_guest_cart";
  }
}
