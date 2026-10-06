import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Inject, Injectable } from "@nestjs/common";
import type { Request } from "express";

import { CsrfService } from "../auth/services/csrf.service";

@Injectable()
export class CartMutationGuard implements CanActivate {
  constructor(@Inject(CsrfService) private readonly csrf: CsrfService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.principal) {
      this.csrf.verifyRequest(
        request,
        "CUSTOMER",
        `session:${request.principal.sessionId}`,
      );
    } else {
      this.csrf.verifyOriginOnly(request);
    }
    return true;
  }
}
