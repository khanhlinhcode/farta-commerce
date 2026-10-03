import "reflect-metadata";

import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { json, urlencoded } from "express";
import helmet from "helmet";

import { AppModule } from "./app.module";
import { createRequestLogger } from "./common/logging";
import { SafeHttpExceptionFilter } from "./common/http-exception.filter";
import { requestIdMiddleware } from "./common/request-id";
import type { Environment } from "./config/environment";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    bufferLogs: true,
  });
  const config = app.get<ConfigService<Environment, true>>(ConfigService);
  const appEnvironment = config.get("APP_ENV", { infer: true });

  app.use(requestIdMiddleware);
  app.use(createRequestLogger());
  app.use(json({ limit: "1mb", strict: true }));
  app.use(urlencoded({ extended: false, limit: "256kb", parameterLimit: 100 }));
  app.use(
    helmet({
      ...(appEnvironment === "production"
        ? {}
        : { contentSecurityPolicy: false, strictTransportSecurity: false }),
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    }),
  );
  app.enableCors({
    origin: [
      config.get("APP_ORIGIN", { infer: true }),
      config.get("ADMIN_ORIGIN", { infer: true }),
    ],
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "content-type",
      "x-request-id",
      "x-csrf-token",
      "idempotency-key",
    ],
  });
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new SafeHttpExceptionFilter());
  app.enableShutdownHooks();

  await app.listen(config.get("PORT", { infer: true }), "0.0.0.0");
}

void bootstrap();
