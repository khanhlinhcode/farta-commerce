import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AuthModule } from "./auth/auth.module";
import { validateEnvironment } from "./config/environment";
import { HealthModule } from "./health/health.module";
import { DatabaseModule } from "./infrastructure/database.module";
import { RedisModule } from "./infrastructure/redis.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
    }),
    DatabaseModule,
    RedisModule,
    AuthModule,
    HealthModule,
  ],
})
export class AppModule {}
