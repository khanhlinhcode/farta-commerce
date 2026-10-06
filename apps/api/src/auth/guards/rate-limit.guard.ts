import type { CanActivate, ExecutionContext } from "@nestjs/common";
import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { createHash } from "node:crypto";
import type { Request, Response } from "express";

import type { Environment } from "../../config/environment";
import { RedisService } from "../../infrastructure/redis.service";
import {
  RATE_LIMIT_KEY,
  type RateLimitPolicy,
} from "../decorators/rate-limit.decorator";

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(ConfigService)
    private readonly config: ConfigService<Environment, true>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policy = this.reflector.getAllAndOverride<
      RateLimitPolicy | undefined
    >(RATE_LIMIT_KEY, [context.getHandler(), context.getClass()]);
    if (!policy) return true;
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const settings = this.settings(policy);
    const identity = createHash("sha256")
      .update(request.ip || request.socket.remoteAddress || "unknown")
      .digest("hex");
    try {
      const result = await this.redis.consumeRateLimit(
        `rate:${policy}:${identity}`,
        settings.limit,
        settings.windowSeconds,
      );
      response.setHeader("X-RateLimit-Remaining", String(result.remaining));
      if (!result.allowed)
        throw new HttpException(
          "Too many requests.",
          HttpStatus.TOO_MANY_REQUESTS,
        );
      return true;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException("Security service is unavailable.");
    }
  }

  private settings(policy: RateLimitPolicy): {
    limit: number;
    windowSeconds: number;
  } {
    switch (policy) {
      case "AUTH_LOGIN":
        return {
          limit: this.config.get("AUTH_LOGIN_LIMIT", { infer: true }),
          windowSeconds: this.config.get("AUTH_LOGIN_WINDOW_SECONDS", {
            infer: true,
          }),
        };
      case "AUTH_REFRESH":
        return {
          limit: this.config.get("AUTH_REFRESH_LIMIT", { infer: true }),
          windowSeconds: this.config.get("AUTH_REFRESH_WINDOW_SECONDS", {
            infer: true,
          }),
        };
      case "CART_MUTATION":
        return {
          limit: this.config.get("CART_MUTATION_LIMIT", { infer: true }),
          windowSeconds: this.config.get("CART_MUTATION_WINDOW_SECONDS", {
            infer: true,
          }),
        };
      case "CART_MERGE":
        return {
          limit: this.config.get("CART_MERGE_LIMIT", { infer: true }),
          windowSeconds: this.config.get("CART_MERGE_WINDOW_SECONDS", {
            infer: true,
          }),
        };
    }
  }
}
