import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

import type { Environment } from "../../config/environment";
import type { AuthRealm } from "../auth.constants";

export type AccessClaims = {
  userId: string;
  sessionId: string;
  realm: AuthRealm;
  rolesVersion: number;
};

@Injectable()
export class TokenService {
  private readonly accessSecret: Uint8Array;
  private readonly refreshPepper: string;
  private readonly issuer: string;
  private readonly customerAudience: string;
  private readonly staffAudience: string;
  private readonly accessTtl: number;

  constructor(@Inject(ConfigService) config: ConfigService<Environment, true>) {
    this.accessSecret = new TextEncoder().encode(
      config.get("JWT_ACCESS_SECRET", { infer: true }),
    );
    this.refreshPepper = config.get("JWT_REFRESH_SECRET", { infer: true });
    this.issuer = config.get("JWT_ISSUER", { infer: true });
    this.customerAudience = config.get("JWT_CUSTOMER_AUDIENCE", {
      infer: true,
    });
    this.staffAudience = config.get("JWT_STAFF_AUDIENCE", { infer: true });
    this.accessTtl = config.get("JWT_ACCESS_TTL_SECONDS", { infer: true });
  }

  async issueAccessToken(claims: AccessClaims): Promise<string> {
    return new SignJWT({
      sid: claims.sessionId,
      realm: claims.realm,
      rolesVersion: claims.rolesVersion,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(claims.userId)
      .setIssuer(this.issuer)
      .setAudience(this.audience(claims.realm))
      .setJti(randomUUID())
      .setIssuedAt()
      .setExpirationTime(`${this.accessTtl}s`)
      .sign(this.accessSecret);
  }

  async verifyAccessToken(
    token: string,
    realm: AuthRealm,
  ): Promise<AccessClaims> {
    try {
      const { payload, protectedHeader } = await jwtVerify(
        token,
        this.accessSecret,
        {
          issuer: this.issuer,
          audience: this.audience(realm),
          algorithms: ["HS256"],
          typ: "JWT",
        },
      );
      if (
        protectedHeader.alg !== "HS256" ||
        payload.realm !== realm ||
        typeof payload.sub !== "string" ||
        typeof payload.sid !== "string" ||
        typeof payload.rolesVersion !== "number"
      ) {
        throw new Error("Invalid access claims");
      }
      return {
        userId: payload.sub,
        sessionId: payload.sid,
        realm,
        rolesVersion: payload.rolesVersion,
      };
    } catch {
      throw new UnauthorizedException("Authentication is required.");
    }
  }

  createRefreshCredential(sessionId: string): {
    raw: string;
    digest: string;
  } {
    const secret = randomBytes(32).toString("base64url");
    return {
      raw: `${sessionId}.${secret}`,
      digest: this.digestRefresh(secret),
    };
  }

  parseRefreshCredential(raw: string): { sessionId: string; digest: string } {
    const match = /^([a-f0-9]{24})\.([A-Za-z0-9_-]{43})$/.exec(raw);
    if (!match?.[1] || !match[2])
      throw new UnauthorizedException("Invalid refresh credential.");
    return { sessionId: match[1], digest: this.digestRefresh(match[2]) };
  }

  digestsEqual(left: string, right: string): boolean {
    const leftBytes = Buffer.from(left, "hex");
    const rightBytes = Buffer.from(right, "hex");
    return (
      leftBytes.length === rightBytes.length &&
      timingSafeEqual(leftBytes, rightBytes)
    );
  }

  accessTtlSeconds(): number {
    return this.accessTtl;
  }

  private digestRefresh(secret: string): string {
    return createHmac("sha256", this.refreshPepper)
      .update(secret)
      .digest("hex");
  }

  private audience(realm: AuthRealm): string {
    return realm === "CUSTOMER" ? this.customerAudience : this.staffAudience;
  }
}
