import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getConnectionToken } from "@nestjs/mongoose";
import Redis from "ioredis";
import { randomUUID } from "node:crypto";
import type { Response as SupertestResponse } from "supertest";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Connection } from "mongoose";

import { configureHttpApplication } from "../src/configure-http-app";
import { RedisService } from "../src/infrastructure/redis.service";

const origin = "http://localhost:3000";
const redisUrl = "redis://localhost:6379/15";

function cookieValue(response: SupertestResponse, name: string): string {
  const raw = response.headers["set-cookie"];
  const cookies = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const cookie = cookies.find((value) => value.startsWith(`${name}=`));
  if (!cookie) throw new Error(`Missing cookie: ${name}`);
  return cookie.split(";", 1)[0] ?? "";
}

function authenticatedCookies(response: SupertestResponse): string {
  return [
    cookieValue(response, "farta_customer_access"),
    cookieValue(response, "farta_customer_csrf"),
  ].join("; ");
}

describe("authentication security foundation", () => {
  let app: INestApplication;
  let mongo: Connection;
  let redis: RedisService;

  beforeAll(async () => {
    Object.assign(process.env, {
      APP_ENV: "test",
      PORT: "4000",
      APP_ORIGIN: origin,
      ADMIN_ORIGIN: "http://localhost:5173",
      API_ORIGIN: "http://localhost:4000",
      MONGODB_URI:
        "mongodb://localhost:27017/farta_auth_e2e?replicaSet=rs0&directConnection=true",
      REDIS_URL: redisUrl,
      JWT_ACCESS_SECRET: "a".repeat(32),
      JWT_REFRESH_SECRET: "b".repeat(32),
      CSRF_SECRET: "c".repeat(32),
      CART_CREDENTIAL_SECRET: "d".repeat(32),
      JWT_ISSUER: "farta-api-test",
      JWT_CUSTOMER_AUDIENCE: "farta-storefront-test",
      JWT_STAFF_AUDIENCE: "farta-admin-test",
      JWT_ACCESS_TTL_SECONDS: "300",
      SESSION_IDLE_TTL_SECONDS: "3600",
      SESSION_ABSOLUTE_TTL_SECONDS: "7200",
      BCRYPT_COST: "10",
      AUTH_LOGIN_LIMIT: "50",
      AUTH_LOGIN_WINDOW_SECONDS: "300",
      AUTH_REFRESH_LIMIT: "50",
      AUTH_REFRESH_WINDOW_SECONDS: "300",
      CART_MAX_ITEM_QUANTITY: "10",
      GUEST_CART_TTL_SECONDS: "2592000",
      CUSTOMER_CART_TTL_SECONDS: "7776000",
      CART_MUTATION_LIMIT: "120",
      CART_MUTATION_WINDOW_SECONDS: "300",
      CART_MERGE_LIMIT: "20",
      CART_MERGE_WINDOW_SECONDS: "300",
    });

    const redisCleanup = new Redis(redisUrl);
    await redisCleanup.flushdb();
    await redisCleanup.quit();

    const { AppModule } = await import("../src/app.module");
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureHttpApplication(app, { requestLogging: false });
    await app.init();
    mongo = app.get<Connection>(getConnectionToken());
    redis = app.get(RedisService);
    await mongo.db?.collection("sessions").deleteMany({});
    await mongo.db?.collection("users").deleteMany({});
  }, 30_000);

  afterAll(async () => {
    await mongo?.db?.dropDatabase();
    await app?.close();
  });

  it("rejects mass assignment and NoSQL-shaped credential input", async () => {
    const agent = request.agent(app.getHttpServer());
    const csrf = await agent.get("/api/v1/auth/customer/csrf").expect(200);

    await agent
      .post("/api/v1/auth/customer/register")
      .set("origin", origin)
      .set("x-csrf-token", csrf.body.csrfToken as string)
      .send({
        email: "blocked@example.test",
        password: "a secure test password",
        displayName: "Blocked",
        role: "OWNER",
      })
      .expect(400);

    await agent
      .post("/api/v1/auth/customer/login")
      .set("origin", origin)
      .set("x-csrf-token", csrf.body.csrfToken as string)
      .send({ email: { $ne: null }, password: "irrelevant" })
      .expect(400);
  });

  it("rejects cross-origin pre-auth state changes", async () => {
    const agent = request.agent(app.getHttpServer());
    const csrf = await agent.get("/api/v1/auth/customer/csrf").expect(200);

    await agent
      .post("/api/v1/auth/customer/login")
      .set("origin", "https://attacker.example")
      .set("x-csrf-token", csrf.body.csrfToken as string)
      .send({ email: "nobody@example.test", password: "irrelevant" })
      .expect(403);
  });

  it("registers a customer without accepting role authority", async () => {
    const agent = request.agent(app.getHttpServer());
    const csrf = await agent.get("/api/v1/auth/customer/csrf").expect(200);
    const registered = await agent
      .post("/api/v1/auth/customer/register")
      .set("origin", origin)
      .set("x-csrf-token", csrf.body.csrfToken as string)
      .send({
        email: "customer@example.test",
        password: "a secure test password",
        displayName: "Linh",
      })
      .expect(201);

    expect(registered.body.user).toMatchObject({
      email: "customer@example.test",
      displayName: "Linh",
      roles: ["CUSTOMER"],
    });
    expect(registered.body.user).not.toHaveProperty("passwordHash");
    expect(registered.body).not.toHaveProperty("accessToken");
    expect(registered.body).not.toHaveProperty("refreshToken");

    const accessCookie = cookieValue(registered, "farta_customer_access");
    await request(app.getHttpServer())
      .get("/api/v1/auth/staff/me")
      .set("Cookie", accessCookie.replace("customer", "staff"))
      .expect(401);
  });

  it("returns the same safe error for unknown accounts and wrong passwords", async () => {
    const agent = request.agent(app.getHttpServer());
    const csrf = await agent.get("/api/v1/auth/customer/csrf").expect(200);
    const attempts = [
      { email: "unknown@example.test", password: "incorrect password" },
      { email: "customer@example.test", password: "incorrect password" },
    ];

    for (const attempt of attempts) {
      const response = await agent
        .post("/api/v1/auth/customer/login")
        .set("origin", origin)
        .set("x-csrf-token", csrf.body.csrfToken as string)
        .send(attempt)
        .expect(401);
      expect(response.body.error).toMatchObject({
        code: "AUTH_INVALID_CREDENTIALS",
        message: "Invalid credentials.",
      });
    }
  });

  it("resolves concurrent duplicate registration through the database unique index", async () => {
    const first = request.agent(app.getHttpServer());
    const second = request.agent(app.getHttpServer());
    const [firstCsrf, secondCsrf] = await Promise.all([
      first.get("/api/v1/auth/customer/csrf").expect(200),
      second.get("/api/v1/auth/customer/csrf").expect(200),
    ]);
    const payload = {
      email: "registration-race@example.test",
      password: "a secure registration password",
      displayName: "Registration Race",
    };

    const responses = await Promise.all([
      first
        .post("/api/v1/auth/customer/register")
        .set("origin", origin)
        .set("x-csrf-token", firstCsrf.body.csrfToken as string)
        .send(payload),
      second
        .post("/api/v1/auth/customer/register")
        .set("origin", origin)
        .set("x-csrf-token", secondCsrf.body.csrfToken as string)
        .send(payload),
    ]);

    expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
  });

  it("enforces session ownership when revoking another device", async () => {
    const owner = request.agent(app.getHttpServer());
    const ownerCsrf = await owner.get("/api/v1/auth/customer/csrf").expect(200);
    const ownerLogin = await owner
      .post("/api/v1/auth/customer/login")
      .set("origin", origin)
      .set("x-csrf-token", ownerCsrf.body.csrfToken as string)
      .send({
        email: "customer@example.test",
        password: "a secure test password",
      })
      .expect(201);
    const ownerCookie = authenticatedCookies(ownerLogin);

    const other = request.agent(app.getHttpServer());
    const otherCsrf = await other.get("/api/v1/auth/customer/csrf").expect(200);
    const otherRegistration = await other
      .post("/api/v1/auth/customer/register")
      .set("origin", origin)
      .set("x-csrf-token", otherCsrf.body.csrfToken as string)
      .send({
        email: "other@example.test",
        password: "another secure password",
        displayName: "Other",
      })
      .expect(201);
    const otherCookie = authenticatedCookies(otherRegistration);
    const otherSessions = await request(app.getHttpServer())
      .get("/api/v1/auth/customer/sessions")
      .set("Cookie", otherCookie)
      .expect(200);
    const otherSessionId = otherSessions.body.sessions[0]?.id as string;

    await request(app.getHttpServer())
      .delete(`/api/v1/auth/customer/sessions/${otherSessionId}`)
      .set("origin", origin)
      .set("x-csrf-token", ownerLogin.body.csrfToken as string)
      .set("Cookie", ownerCookie)
      .expect(404);

    await request(app.getHttpServer())
      .get("/api/v1/auth/customer/me")
      .set("Cookie", otherCookie)
      .expect(200);
  });

  it("rotates refresh credentials and revokes the family on replay", async () => {
    const agent = request.agent(app.getHttpServer());
    const preAuth = await agent.get("/api/v1/auth/customer/csrf").expect(200);
    const login = await agent
      .post("/api/v1/auth/customer/login")
      .set("origin", origin)
      .set("x-csrf-token", preAuth.body.csrfToken as string)
      .send({
        email: "customer@example.test",
        password: "a secure test password",
      })
      .expect(201);
    const oldRefresh = cookieValue(login, "farta_customer_refresh");
    const oldCsrf = cookieValue(login, "farta_customer_csrf");

    await agent
      .post("/api/v1/auth/customer/refresh")
      .set("origin", origin)
      .set("x-csrf-token", login.body.csrfToken as string)
      .expect(201);

    await request(app.getHttpServer())
      .post("/api/v1/auth/customer/refresh")
      .set("origin", origin)
      .set("x-csrf-token", login.body.csrfToken as string)
      .set("Cookie", `${oldRefresh}; ${oldCsrf}`)
      .expect(401);

    await agent.get("/api/v1/auth/customer/me").expect(401);
  });

  it("fails closed when the same refresh credential is used concurrently", async () => {
    const agent = request.agent(app.getHttpServer());
    const csrf = await agent.get("/api/v1/auth/customer/csrf").expect(200);
    const registered = await agent
      .post("/api/v1/auth/customer/register")
      .set("origin", origin)
      .set("x-csrf-token", csrf.body.csrfToken as string)
      .send({
        email: "refresh-race@example.test",
        password: "a secure race password",
        displayName: "Refresh Race",
      })
      .expect(201);
    const refreshCookie = cookieValue(registered, "farta_customer_refresh");
    const csrfCookie = cookieValue(registered, "farta_customer_csrf");
    const sendRefresh = () =>
      request(app.getHttpServer())
        .post("/api/v1/auth/customer/refresh")
        .set("origin", origin)
        .set("x-csrf-token", registered.body.csrfToken as string)
        .set("Cookie", `${refreshCookie}; ${csrfCookie}`);

    const responses = await Promise.all([sendRefresh(), sendRefresh()]);
    expect(responses.map(({ status }) => status).sort()).toEqual([201, 401]);

    const successful = responses.find(({ status }) => status === 201);
    expect(successful).toBeDefined();
    await request(app.getHttpServer())
      .get("/api/v1/auth/customer/me")
      .set("Cookie", authenticatedCookies(successful as SupertestResponse))
      .expect(401);
  });

  it("revokes the current session and all remaining sessions", async () => {
    const first = request.agent(app.getHttpServer());
    const firstCsrf = await first.get("/api/v1/auth/customer/csrf").expect(200);
    const registered = await first
      .post("/api/v1/auth/customer/register")
      .set("origin", origin)
      .set("x-csrf-token", firstCsrf.body.csrfToken as string)
      .send({
        email: "logout@example.test",
        password: "a secure logout password",
        displayName: "Logout Test",
      })
      .expect(201);

    const second = request.agent(app.getHttpServer());
    const secondCsrf = await second
      .get("/api/v1/auth/customer/csrf")
      .expect(200);
    const login = await second
      .post("/api/v1/auth/customer/login")
      .set("origin", origin)
      .set("x-csrf-token", secondCsrf.body.csrfToken as string)
      .send({
        email: "logout@example.test",
        password: "a secure logout password",
      })
      .expect(201);

    const firstCookie = authenticatedCookies(registered);
    const secondCookie = authenticatedCookies(login);
    await request(app.getHttpServer())
      .post("/api/v1/auth/customer/logout")
      .set("origin", origin)
      .set("x-csrf-token", registered.body.csrfToken as string)
      .set("Cookie", firstCookie)
      .expect(204);
    await request(app.getHttpServer())
      .get("/api/v1/auth/customer/me")
      .set("Cookie", firstCookie)
      .expect(401);
    await request(app.getHttpServer())
      .get("/api/v1/auth/customer/me")
      .set("Cookie", secondCookie)
      .expect(200);

    await request(app.getHttpServer())
      .post("/api/v1/auth/customer/logout-all")
      .set("origin", origin)
      .set("x-csrf-token", login.body.csrfToken as string)
      .set("Cookie", secondCookie)
      .expect(204);
    await request(app.getHttpServer())
      .get("/api/v1/auth/customer/me")
      .set("Cookie", secondCookie)
      .expect(401);
  });

  it("uses Redis-backed atomic counters for distributed rate policies", async () => {
    const key = `test:${randomUUID()}`;
    await expect(redis.consumeRateLimit(key, 2, 60)).resolves.toMatchObject({
      allowed: true,
      remaining: 1,
    });
    await expect(redis.consumeRateLimit(key, 2, 60)).resolves.toMatchObject({
      allowed: true,
      remaining: 0,
    });
    await expect(redis.consumeRateLimit(key, 2, 60)).resolves.toMatchObject({
      allowed: false,
      remaining: 0,
    });
  });

  it("reports readiness only while MongoDB and Redis are healthy", () =>
    request(app.getHttpServer()).get("/api/v1/health/ready").expect(200));

  it("applies the configured CORS allowlist and security headers", async () => {
    const allowed = await request(app.getHttpServer())
      .options("/api/v1/auth/customer/login")
      .set("origin", origin)
      .set("access-control-request-method", "POST")
      .expect(204);
    expect(allowed.headers["access-control-allow-origin"]).toBe(origin);
    expect(allowed.headers["access-control-allow-credentials"]).toBe("true");

    const denied = await request(app.getHttpServer())
      .options("/api/v1/auth/customer/login")
      .set("origin", "https://attacker.example")
      .set("access-control-request-method", "POST")
      .expect(204);
    expect(denied.headers).not.toHaveProperty("access-control-allow-origin");

    const headers = await request(app.getHttpServer())
      .get("/api/v1/auth/customer/csrf")
      .expect(200);
    expect(headers.headers["x-content-type-options"]).toBe("nosniff");
    expect(headers.headers["referrer-policy"]).toBe(
      "strict-origin-when-cross-origin",
    );
  });

  it("enforces the Redis-backed login policy with HTTP 429", async () => {
    const agent = request.agent(app.getHttpServer());
    const csrf = await agent.get("/api/v1/auth/customer/csrf").expect(200);
    let rateLimited = false;
    for (let attempt = 0; attempt < 55; attempt += 1) {
      const response = await agent
        .post("/api/v1/auth/customer/register")
        .set("origin", origin)
        .set("x-csrf-token", csrf.body.csrfToken as string)
        .send({ role: "OWNER" });
      if (response.status === 429) {
        rateLimited = true;
        break;
      }
    }
    expect(rateLimited).toBe(true);
  });
});
