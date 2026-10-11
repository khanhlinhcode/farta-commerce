import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MongooseModule, type MongooseModuleOptions } from "@nestjs/mongoose";
import mongoose from "mongoose";

import type { Environment } from "../config/environment";

export function buildDatabaseOptions(
  appEnvironment: Environment["APP_ENV"],
  uri: string,
): MongooseModuleOptions {
  const commonOptions: MongooseModuleOptions = {
    uri,
    serverSelectionTimeoutMS: 5_000,
    autoIndex: appEnvironment !== "production",
    sanitizeFilter: true,
  };

  // Docker Desktop advertises the Compose-only `mongodb` hostname for the
  // local single-node replica set. A direct host connection still supports
  // replica-set transactions while avoiding discovery of that hostname.
  if (appEnvironment === "development") {
    return { ...commonOptions, directConnection: true };
  }

  return commonOptions;
}

@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environment, true>) => {
        mongoose.set("strictQuery", true);

        return buildDatabaseOptions(
          config.get("APP_ENV", { infer: true }),
          config.get("MONGODB_URI", { infer: true }),
        );
      },
    }),
  ],
})
export class DatabaseModule {}
