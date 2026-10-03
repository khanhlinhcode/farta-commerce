import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";

import { AUTH_REALM_KEY } from "../decorators/auth-realm.decorator";
import type { AuthRealm } from "../auth.constants";
import { AuthCookieService } from "../services/cookie.service";
import { PermissionsService } from "../services/permissions.service";
import { SessionsService } from "../services/sessions.service";
import { TokenService } from "../services/token.service";
import { UsersService } from "../services/users.service";

@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AuthCookieService) private readonly cookies: AuthCookieService,
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(SessionsService) private readonly sessions: SessionsService,
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(PermissionsService)
    private readonly permissions: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const realm = this.reflector.getAllAndOverride<AuthRealm | undefined>(
      AUTH_REALM_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!realm) return true;
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.cookies.read(request, "access", realm);
    if (!token) throw new UnauthorizedException("Authentication is required.");
    const claims = await this.tokens.verifyAccessToken(token, realm);
    await this.sessions.requireActive(claims);
    const user = await this.users.findActiveById(claims.userId);
    if (
      !user ||
      user.rolesVersion !== claims.rolesVersion ||
      !this.users.supportsRealm(user, realm)
    ) {
      throw new UnauthorizedException("Authentication is required.");
    }
    request.principal = {
      userId: user.id,
      sessionId: claims.sessionId,
      realm,
      roles: [...user.roles],
      permissions: [
        ...this.permissions.effectivePermissions(user.roles, user.permissions),
      ],
      rolesVersion: user.rolesVersion,
    };
    return true;
  }
}
