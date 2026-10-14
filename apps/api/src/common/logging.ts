import pinoHttp from "pino-http";

import { isDeployedEnvironment } from "../config/environment";

export const LOG_REDACTION = {
  paths: [
    "req.headers.authorization",
    "req.headers.cookie",
    "req.body.password",
    "req.body.passwordHash",
    "req.body.refreshToken",
    "req.body.accessToken",
    "req.body.resetToken",
    "req.body.oauthToken",
    "*.MONGODB_URI",
    "*.REDIS_URL",
    "*.JWT_ACCESS_SECRET",
    "*.JWT_REFRESH_SECRET",
    "*.CSRF_SECRET",
    "*.CART_CREDENTIAL_SECRET",
    "*.ORDER_LOOKUP_SECRET",
    "*.GOOGLE_CLIENT_SECRET",
    "*.APPLE_PRIVATE_KEY",
    "*.CLOUDINARY_API_SECRET",
    "*.SEPAY_WEBHOOK_SECRET",
  ],
  censor: "[REDACTED]",
};

export function createRequestLogger() {
  return pinoHttp({
    level: logLevelForEnvironment(process.env.APP_ENV),
    genReqId: (request) => request.id,
    redact: LOG_REDACTION,
    serializers: {
      req(request) {
        return { id: request.id, method: request.method, url: request.url };
      },
      res(response) {
        return { statusCode: response.statusCode };
      },
    },
  });
}

export function logLevelForEnvironment(environment: unknown): "info" | "debug" {
  return isDeployedEnvironment(environment) ? "info" : "debug";
}
