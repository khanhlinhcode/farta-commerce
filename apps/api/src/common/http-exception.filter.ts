import {
  Catch,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
  type ExceptionFilter,
} from "@nestjs/common";
import type { Request, Response } from "express";

@Catch()
export class SafeHttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const code =
      status === HttpStatus.INTERNAL_SERVER_ERROR
        ? "INTERNAL_ERROR"
        : `HTTP_${status}`;
    const safeMessage =
      status === HttpStatus.INTERNAL_SERVER_ERROR
        ? "An unexpected error occurred."
        : this.message(exception);

    response
      .status(status)
      .json({ error: { code, message: safeMessage, requestId: request.id } });
  }

  private message(exception: unknown): string {
    if (!(exception instanceof HttpException)) return "Request failed.";
    const payload: unknown = exception.getResponse();
    if (typeof payload === "string") return payload;
    if (
      typeof payload === "object" &&
      payload !== null &&
      "message" in payload
    ) {
      const message = (payload as { message?: unknown }).message;
      if (typeof message === "string") return message;
      if (Array.isArray(message)) return "Request validation failed.";
    }
    return exception.message;
  }
}
