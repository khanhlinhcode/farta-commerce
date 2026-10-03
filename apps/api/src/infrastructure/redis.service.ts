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
  async consumeRateLimit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; remaining: number }> {
    const result = (await this.client.eval(
      `local current = redis.call('INCR', KEYS[1])
       if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
       return current`,
      1,
      key,
      String(windowSeconds),
    )) as number;
    return { allowed: result <= limit, remaining: Math.max(0, limit - result) };
  }
  async setOnce(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    return (await this.client.set(key, value, "EX", ttlSeconds, "NX")) === "OK";
  }
  async getAndDelete(key: string): Promise<string | null> {
    return this.client.getdel(key);
  }
  async onApplicationShutdown(): Promise<void> {
    await this.client.quit();
  }
}
