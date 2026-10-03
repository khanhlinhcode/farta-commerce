import { randomUUID } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{8,128}$/;

export function requestIdMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const incoming = request.header("x-request-id");
  const requestId =
    incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
  request.id = requestId;
  response.setHeader("x-request-id", requestId);
  next();
}
