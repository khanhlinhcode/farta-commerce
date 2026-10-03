import pinoHttp from "pino-http";

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
    "*.CLOUDINARY_API_SECRET",
  ],
  censor: "[REDACTED]",
};

export function createRequestLogger() {
  return pinoHttp({
    level: process.env.APP_ENV === "production" ? "info" : "debug",
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
