import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import helmet from "helmet";

import { SafeHttpExceptionFilter } from "./common/http-exception.filter";
import { createRequestLogger } from "./common/logging";
import { requestIdMiddleware } from "./common/request-id";
import type { Environment } from "./config/environment";

export function configureHttpApplication(
  app: INestApplication,
  options: { requestLogging?: boolean } = {},
): void {
  const config = app.get<ConfigService<Environment, true>>(ConfigService);
  const appEnvironment = config.get("APP_ENV", { infer: true });

  app.use(requestIdMiddleware);
  if (options.requestLogging !== false) app.use(createRequestLogger());
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
}
