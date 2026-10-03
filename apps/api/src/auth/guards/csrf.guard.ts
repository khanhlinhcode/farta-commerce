import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";

import { CSRF_KEY, type CsrfRequirement } from "../decorators/csrf.decorator";
import { AuthCookieService } from "../services/cookie.service";
import { CsrfService } from "../services/csrf.service";
import { TokenService } from "../services/token.service";

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(CsrfService) private readonly csrf: CsrfService,
    @Inject(AuthCookieService) private readonly cookies: AuthCookieService,
    @Inject(TokenService) private readonly tokens: TokenService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requirement = this.reflector.getAllAndOverride<
      CsrfRequirement | undefined
    >(CSRF_KEY, [context.getHandler(), context.getClass()]);
    if (!requirement) return true;
    const request = context.switchToHttp().getRequest<Request>();
    const binding = this.binding(request, requirement);
    this.csrf.verifyRequest(request, requirement.realm, binding);
    return true;
  }

  private binding(request: Request, requirement: CsrfRequirement): string {
    if (requirement.binding === "PRE_AUTH")
      return `preauth:${requirement.realm}`;
    if (requirement.binding === "SESSION") {
      if (!request.principal) return "missing-session";
      return `session:${request.principal.sessionId}`;
    }
    const refresh = this.cookies.read(request, "refresh", requirement.realm);
    if (!refresh) return "missing-refresh";
    return `session:${this.tokens.parseRefreshCredential(refresh).sessionId}`;
  }
}
