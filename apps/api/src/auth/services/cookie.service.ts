import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { parseCookie, stringifySetCookie, type SerializeOptions } from "cookie";
import type { Request, Response } from "express";

import {
  isDeployedEnvironment,
  type Environment,
} from "../../config/environment";
import type { AuthRealm } from "../auth.constants";

@Injectable()
export class AuthCookieService {
  private readonly deployed: boolean;
  private readonly accessTtl: number;
  private readonly refreshTtl: number;

  constructor(@Inject(ConfigService) config: ConfigService<Environment, true>) {
    this.deployed = isDeployedEnvironment(
      config.get("APP_ENV", { infer: true }),
    );
    this.accessTtl = config.get("JWT_ACCESS_TTL_SECONDS", { infer: true });
    this.refreshTtl = config.get("SESSION_ABSOLUTE_TTL_SECONDS", {
      infer: true,
    });
  }

  read(
    request: Request,
    kind: "access" | "refresh" | "csrf",
    realm: AuthRealm,
  ) {
    const cookies = parseCookie(request.headers.cookie ?? "");
    return cookies[this.name(kind, realm)];
  }

  setCredentials(
    response: Response,
    realm: AuthRealm,
    accessToken: string,
    refreshToken: string,
    csrfToken: string,
  ): void {
    this.append(response, "access", realm, accessToken, {
      httpOnly: true,
      maxAge: this.accessTtl,
      sameSite: "lax",
      path: "/",
    });
    this.append(response, "refresh", realm, refreshToken, {
      httpOnly: true,
      maxAge: this.refreshTtl,
      sameSite: "strict",
      path: `/api/v1/auth/${realm === "CUSTOMER" ? "customer" : "staff"}/refresh`,
    });
    this.setCsrf(response, realm, csrfToken);
  }

  setCsrf(response: Response, realm: AuthRealm, token: string): void {
    this.append(response, "csrf", realm, token, {
      httpOnly: false,
      maxAge: 3600,
      sameSite: "lax",
      path: "/",
    });
  }

  clear(response: Response, realm: AuthRealm): void {
    this.append(response, "access", realm, "", {
      httpOnly: true,
      maxAge: 0,
      sameSite: "lax",
      path: "/",
    });
    this.append(response, "refresh", realm, "", {
      httpOnly: true,
      maxAge: 0,
      sameSite: "strict",
      path: `/api/v1/auth/${realm === "CUSTOMER" ? "customer" : "staff"}/refresh`,
    });
    this.append(response, "csrf", realm, "", {
      httpOnly: false,
      maxAge: 0,
      sameSite: "lax",
      path: "/",
    });
  }

  private append(
    response: Response,
    kind: "access" | "refresh" | "csrf",
    realm: AuthRealm,
    value: string,
    options: SerializeOptions,
  ): void {
    response.append(
      "Set-Cookie",
      stringifySetCookie({
        name: this.name(kind, realm),
        value,
        ...options,
        secure: this.deployed,
      }),
    );
  }

  private name(kind: "access" | "refresh" | "csrf", realm: AuthRealm): string {
    const realmName = realm === "CUSTOMER" ? "customer" : "staff";
    if (!this.deployed) return `farta_${realmName}_${kind}`;
    const prefix = kind === "access" ? "__Host-" : "__Secure-";
    return `${prefix}farta_${realmName}_${kind}`;
  }
}
