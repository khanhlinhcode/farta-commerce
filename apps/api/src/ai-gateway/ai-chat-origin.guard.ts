import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Inject, Injectable } from "@nestjs/common";
import type { Request } from "express";

import { CsrfService } from "../auth/services/csrf.service";

@Injectable()
export class AiChatOriginGuard implements CanActivate {
  constructor(@Inject(CsrfService) private readonly csrf: CsrfService) {}

  canActivate(context: ExecutionContext): boolean {
    this.csrf.verifyOriginOnly(context.switchToHttp().getRequest<Request>());
    return true;
  }
}
