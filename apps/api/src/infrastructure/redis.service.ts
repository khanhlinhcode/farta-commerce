import {
  Inject,
  Injectable,
  type OnApplicationShutdown,
  type OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

import type { Environment } from "../config/environment";

@Injectable()
export class RedisService implements OnModuleInit, OnApplicationShutdown {
  private readonly client: Redis;

  constructor(@Inject(ConfigService) config: ConfigService<Environment, true>) {
    this.client = new Redis(config.get("REDIS_URL", { infer: true }), {
      lazyConnect: true,
      enableReadyCheck: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 5_000,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.client.connect();
  }
  async ping(): Promise<boolean> {
    return (await this.client.ping()) === "PONG";
  }
  async onApplicationShutdown(): Promise<void> {
    await this.client.quit();
  }
}
