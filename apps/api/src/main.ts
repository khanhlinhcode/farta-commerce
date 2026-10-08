import "reflect-metadata";

import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";

import { AppModule } from "./app.module";
import type { Environment } from "./config/environment";
import { configureHttpApplication } from "./configure-http-app";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    bufferLogs: true,
    rawBody: true,
  });
  const config = app.get<ConfigService<Environment, true>>(ConfigService);
  app.useBodyParser("json", { limit: "1mb", strict: true });
  app.useBodyParser("urlencoded", {
    extended: false,
    limit: "256kb",
    parameterLimit: 100,
  });
  configureHttpApplication(app);
  app.enableShutdownHooks();

  await app.listen(config.get("PORT", { infer: true }), "0.0.0.0");
}

void bootstrap();
