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
    const source = request.ip || request.socket.remoteAddress || "unknown";
    const paymentResource =
      policy === "PAYMENT_INITIATE" || policy === "PAYMENT_STATUS"
        ? String(request.params.orderCode ?? "unknown").slice(0, 64)
        : null;
    const sourceIdentity = createHash("sha256").update(source).digest("hex");
    const buckets = paymentResource
      ? [
          {
            key: `rate:${policy}:source:${sourceIdentity}`,
            limit: settings.globalLimit ?? settings.limit,
          },
          {
            key: `rate:${policy}:resource:${createHash("sha256")
              .update(`${source}:${paymentResource}`)
              .digest("hex")}`,
            limit: settings.limit,
          },
        ]
      : [{ key: `rate:${policy}:${sourceIdentity}`, limit: settings.limit }];
    try {
      let remaining = Number.MAX_SAFE_INTEGER;
      for (const bucket of buckets) {
        const result = await this.redis.consumeRateLimit(
          bucket.key,
          bucket.limit,
          settings.windowSeconds,
        );
        remaining = Math.min(remaining, result.remaining);
        if (!result.allowed)
          throw new HttpException(
            "Too many requests.",
            HttpStatus.TOO_MANY_REQUESTS,
          );
      }
      response.setHeader("X-RateLimit-Remaining", String(remaining));
      return true;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException("Security service is unavailable.");
    }
  }

  private settings(policy: RateLimitPolicy): {
    limit: number;
    windowSeconds: number;
    globalLimit?: number;
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
      case "CHECKOUT":
        return {
          limit: this.config.get("CHECKOUT_LIMIT", { infer: true }),
          windowSeconds: this.config.get("CHECKOUT_WINDOW_SECONDS", {
            infer: true,
          }),
        };
      case "ORDER_LOOKUP":
        return {
          limit: this.config.get("ORDER_LOOKUP_LIMIT", { infer: true }),
          windowSeconds: this.config.get("ORDER_LOOKUP_WINDOW_SECONDS", {
            infer: true,
          }),
        };
      case "PAYMENT_INITIATE":
        return {
          limit: this.config.get("PAYMENT_INITIATE_LIMIT", { infer: true }),
          globalLimit: this.config.get("PAYMENT_INITIATE_GLOBAL_LIMIT", {
            infer: true,
          }),
          windowSeconds: this.config.get("PAYMENT_INITIATE_WINDOW_SECONDS", {
            infer: true,
          }),
        };
      case "PAYMENT_STATUS":
        return {
          limit: this.config.get("PAYMENT_STATUS_LIMIT", { infer: true }),
          globalLimit: this.config.get("PAYMENT_STATUS_GLOBAL_LIMIT", {
            infer: true,
          }),
          windowSeconds: this.config.get("PAYMENT_STATUS_WINDOW_SECONDS", {
            infer: true,
          }),
        };
      case "AI_CHAT":
        return {
          limit: this.config.get("AI_CHAT_LIMIT", { infer: true }),
          windowSeconds: this.config.get("AI_CHAT_WINDOW_SECONDS", {
            infer: true,
          }),
        };
    }
  }
}
