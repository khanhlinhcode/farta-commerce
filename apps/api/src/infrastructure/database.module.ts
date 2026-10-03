import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import mongoose from "mongoose";

import type { Environment } from "../config/environment";

@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environment, true>) => {
        mongoose.set("strictQuery", true);

        return {
          uri: config.get("MONGODB_URI", { infer: true }),
          serverSelectionTimeoutMS: 5_000,
          autoIndex: config.get("APP_ENV", { infer: true }) !== "production",
          sanitizeFilter: true,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
