import type { CanActivate, ExecutionContext } from "@nestjs/common";
import {
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { RawBodyRequest } from "@nestjs/common";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { Request } from "express";

import type { Environment } from "../config/environment";
import { RedisService } from "../infrastructure/redis.service";

const AUDIENCE = "farta-ai-tools";

@Injectable()
export class AiToolAuthGuard implements CanActivate {
  constructor(
    @Inject(ConfigService)
    private readonly config: ConfigService<Environment, true>,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<RawBodyRequest<Request>>();
    const timestamp = this.singleHeader(request, "x-farta-ai-timestamp");
    const nonce = this.singleHeader(request, "x-farta-ai-nonce");
    const audience = this.singleHeader(request, "x-farta-ai-audience");
    const signature = this.singleHeader(request, "x-farta-ai-signature");
    if (
      audience !== AUDIENCE ||
      !/^\d{10}$/.test(timestamp) ||
      !/^[A-Za-z0-9_-]{32,64}$/.test(nonce) ||
      !/^[A-Za-z0-9_-]{43}$/.test(signature) ||
      !request.rawBody
    ) {
      this.reject();
    }

    const now = Math.floor(Date.now() / 1000);
    const issuedAt = Number(timestamp);
    const tolerance = this.config.get("AI_INTERNAL_REQUEST_TOLERANCE_SECONDS", {
      infer: true,
    });
    if (!Number.isSafeInteger(issuedAt) || Math.abs(now - issuedAt) > tolerance)
      this.reject();

    const secret = this.config.get("AI_TOOLS_SHARED_SECRET", { infer: true });
    if (secret.length < 32)
      throw new ServiceUnavailableException("AI tools are unavailable.");
    const payload = [
      timestamp,
      nonce,
      audience,
      request.method.toUpperCase(),
      request.originalUrl,
      request.rawBody.toString("utf8"),
    ].join(".");
    const expected = createHmac("sha256", secret)
      .update(payload)
      .digest("base64url");
    if (!this.safeEqual(signature, expected)) this.reject();

    try {
      const replayKey = createHash("sha256").update(nonce).digest("hex");
      const claimed = await this.redis.setOnce(
        `ai:tool-replay:${replayKey}`,
        timestamp,
        tolerance * 2,
      );
      if (!claimed) this.reject();
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new ServiceUnavailableException("AI tools are unavailable.");
    }
    return true;
  }

  private singleHeader(request: Request, name: string): string {
    const value = request.headers[name];
    return typeof value === "string" ? value : "";
  }

  private safeEqual(left: string, right: string): boolean {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private reject(): never {
    throw new UnauthorizedException("AI service authentication failed.");
  }
}
