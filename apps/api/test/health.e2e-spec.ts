import { Controller, Get, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { SafeHttpExceptionFilter } from "../src/common/http-exception.filter";
import { requestIdMiddleware } from "../src/common/request-id";

@Controller("health")
class TestHealthController {
  @Get("live") live() {
    return { status: "ok" };
  }

  @Get("failure") failure(): never {
    throw new Error("database-internal-secret");
  }
}

describe("API HTTP foundation", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TestHealthController],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use(requestIdMiddleware);
    app.useGlobalFilters(new SafeHttpExceptionFilter());
    app.setGlobalPrefix("api/v1");
    await app.init();
  });

  afterAll(async () => app.close());

  it("boots and emits a correlation id", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/health/live")
      .expect(200);
    expect(response.headers["x-request-id"]).toMatch(/^[A-Za-z0-9-]+$/);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("preserves a safe caller correlation id", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/health/live")
      .set("x-request-id", "client-request-123")
      .expect(200);
    expect(response.headers["x-request-id"]).toBe("client-request-123");
  });

  it("does not expose unexpected exception details", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/health/failure")
      .expect(500);
    expect(response.body.error).toMatchObject({
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred.",
    });
    expect(JSON.stringify(response.body)).not.toContain(
      "database-internal-secret",
    );
    expect(response.body.error.requestId).toMatch(/^[A-Za-z0-9-]+$/);
  });
});
