import {
  Controller,
  Get,
  Inject,
  Req,
  ServiceUnavailableException,
} from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import type { Request } from "express";
import type { Connection } from "mongoose";

import { RedisService } from "../infrastructure/redis.service";

@Controller("health")
export class HealthController {
  constructor(
    @InjectConnection() private readonly mongo: Connection,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {}

  @Get("live")
  liveness(@Req() request: Request) {
    return { status: "ok" as const, requestId: request.id };
  }

  @Get("ready")
  async readiness(@Req() request: Request) {
    const mongoReady = this.mongo.readyState === 1;
    const redisReady = await this.redis.ping().catch(() => false);
    if (!mongoReady || !redisReady)
      throw new ServiceUnavailableException("Service is not ready.");
    return { status: "ok" as const, requestId: request.id };
  }
}
