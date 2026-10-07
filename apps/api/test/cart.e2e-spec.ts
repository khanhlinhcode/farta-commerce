import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getConnectionToken } from "@nestjs/mongoose";
import Redis from "ioredis";
import type { Connection } from "mongoose";
import { Types } from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { configureHttpApplication } from "../src/configure-http-app";

const origin = "http://localhost:3000";
const redisUrl = "redis://localhost:6379/13";

describe("Phase 4A authoritative cart", () => {
  let app: INestApplication;
  let mongo: Connection;
  let variantId: string;

  beforeAll(async () => {
    Object.assign(process.env, {
      APP_ENV: "test",
      PORT: "4000",
      APP_ORIGIN: origin,
      ADMIN_ORIGIN: "http://localhost:5173",
      API_ORIGIN: "http://localhost:4000",
      MONGODB_URI:
        "mongodb://localhost:27017/farta_cart_e2e?replicaSet=rs0&directConnection=true",
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
      CART_MUTATION_LIMIT: "500",
      CART_MUTATION_WINDOW_SECONDS: "300",
      CART_MERGE_LIMIT: "100",
      CART_MERGE_WINDOW_SECONDS: "300",
      CHECKOUT_RESERVATION_TTL_SECONDS: "900",
      SHIPPING_FLAT_FEE_VND: "30000",
      FREE_SHIPPING_THRESHOLD_VND: "1000000",
      ORDER_LOOKUP_SECRET: "e".repeat(32),
      CHECKOUT_LIMIT: "300",
      CHECKOUT_WINDOW_SECONDS: "300",
      ORDER_LOOKUP_LIMIT: "300",
      ORDER_LOOKUP_WINDOW_SECONDS: "300",
    });

    const redis = new Redis(redisUrl);
    await redis.flushdb();
    await redis.quit();
    const { AppModule } = await import("../src/app.module");
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureHttpApplication(app, { requestLogging: false });
    await app.init();
    mongo = app.get<Connection>(getConnectionToken());
    await mongo.db?.dropDatabase();
    await Promise.all(
      Object.values(mongo.models).map((model) => model.syncIndexes()),
    );

    const actorId = new Types.ObjectId();
    const mediaId = new Types.ObjectId();
    const productId = new Types.ObjectId();
    const variantObjectId = new Types.ObjectId();
    variantId = variantObjectId.toString();
    const now = new Date();
    await mongo.db?.collection("media_assets").insertOne({
      _id: mediaId,
      provider: "CLOUDINARY",
      publicId: "farta/test/cart-cover",
      secureUrl:
        "https://res.cloudinary.com/farta-test/image/upload/cart-cover.jpg",
      resourceType: "image",
      format: "jpg",
      width: 1000,
      height: 1250,
      bytes: 1000,
      originalFilename: "cart-cover.jpg",
      altText: "FARTA Cart Tee",
      createdBy: actorId,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    await mongo.db?.collection("products").insertOne({
      _id: productId,
      name: "FARTA Cart Tee",
      slug: "farta-cart-tee",
      shortDescription: null,
      description: null,
      categoryIds: [],
      status: "ACTIVE",
      tags: [],
      coverMediaId: mediaId,
      mediaIds: [],
      seo: { title: null, description: null },
      publishedAt: now,
      createdBy: actorId,
      updatedBy: actorId,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    await mongo.db?.collection("product_variants").insertOne({
      _id: variantObjectId,
      productId,
      sku: "FAR-CART-BLK-M",
      color: "Black",
      colorCode: "#111111",
      size: "M",
      price: 299000,
      compareAtPrice: null,
      status: "ACTIVE",
      mediaIds: [],
      lowStockThreshold: 2,
      createdBy: actorId,
      updatedBy: actorId,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    await mongo.db?.collection("inventory").insertOne({
      variantId: variantObjectId,
      onHand: 20,
      reserved: 0,
      createdAt: now,
      updatedAt: now,
    });
  }, 30_000);

  afterAll(async () => {
    await mongo?.db?.dropDatabase();
    await app?.close();
  });

  async function register(email: string): Promise<{
    agent: ReturnType<typeof request.agent>;
    csrfToken: string;
    cookieHeader: string;
  }> {
    const agent = request.agent(app.getHttpServer());
    const csrf = await agent.get("/api/v1/auth/customer/csrf").expect(200);
    const registered = await agent
      .post("/api/v1/auth/customer/register")
      .set("origin", origin)
      .set("x-csrf-token", csrf.body.csrfToken as string)
      .send({
        email,
        password: "a secure cart test password",
        displayName: "Cart Customer",
      })
      .expect(201);
    const rawCookies = registered.headers["set-cookie"];
    const cookieHeader = (Array.isArray(rawCookies) ? rawCookies : [rawCookies])
      .filter((value): value is string => Boolean(value))
      .map((value) => value.split(";", 1)[0])
      .join("; ");
    return {
      agent,
      csrfToken: registered.body.csrfToken as string,
      cookieHeader,
    };
  }

  it("supports guest add, read, update, remove and idempotent clear", async () => {
    const guest = request.agent(app.getHttpServer());
    const empty = await guest.get("/api/v1/cart").expect(200);
    expect(empty.body).toMatchObject({ itemCount: 0, subtotal: 0 });
    expect(String(empty.headers["set-cookie"])).toContain("farta_guest_cart=");

    const added = await guest
      .post("/api/v1/cart/items")
      .set("origin", origin)
      .send({ variantId, quantity: 2 })
      .expect(201);
    expect(added.body).toMatchObject({
      itemCount: 2,
      subtotal: 598000,
      total: 598000,
    });
    expect(added.body.items[0]).toMatchObject({
      unitPrice: 299000,
      lineSubtotal: 598000,
      availability: "IN_STOCK",
    });
    expect(added.body.items[0]).not.toHaveProperty("onHand");
    const itemId = added.body.items[0].id as string;

    const updated = await guest
      .patch(`/api/v1/cart/items/${itemId}`)
      .set("origin", origin)
      .send({ quantity: 3 })
      .expect(200);
    expect(updated.body.total).toBe(897000);

    await guest
      .delete(`/api/v1/cart/items/${itemId}`)
      .set("origin", origin)
      .expect(200);
    await guest.delete("/api/v1/cart").set("origin", origin).expect(200);
    const clearedAgain = await guest
      .delete("/api/v1/cart")
      .set("origin", origin)
      .expect(200);
    expect(clearedAgain.body.itemCount).toBe(0);
  });

  it("rejects cross-origin, owner, price, operator and invalid quantity payloads", async () => {
    const guest = request.agent(app.getHttpServer());
    await guest.get("/api/v1/cart").expect(200);
    await guest
      .post("/api/v1/cart/items")
      .set("origin", "https://attacker.example")
      .send({ variantId, quantity: 1 })
      .expect(403);
    for (const payload of [
      { variantId, quantity: 1, price: 1 },
      { variantId, quantity: 1, customerId: new Types.ObjectId().toString() },
      { variantId: { $ne: null }, quantity: 1 },
      { variantId, quantity: 0 },
      { variantId, quantity: 11 },
    ]) {
      await guest
        .post("/api/v1/cart/items")
        .set("origin", origin)
        .send(payload)
        .expect(400);
    }
  });

  it("rejects a guessed guest credential without creating a replacement cart", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/cart")
      .set("Cookie", `farta_guest_cart=${"x".repeat(43)}.${"y".repeat(43)}`)
      .expect(401);
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("keeps authenticated customer carts isolated and enforces CSRF", async () => {
    const first = await register("cart-a@example.test");
    const second = await register("cart-b@example.test");

    await first.agent
      .post("/api/v1/cart/items")
      .set("origin", origin)
      .send({ variantId, quantity: 1 })
      .expect(403);
    await first.agent
      .post("/api/v1/cart/items")
      .set("origin", origin)
      .set("x-csrf-token", first.csrfToken)
      .send({ variantId, quantity: 1 })
      .expect(201);
    const firstCart = await first.agent.get("/api/v1/cart").expect(200);
    const secondCart = await second.agent.get("/api/v1/cart").expect(200);
    expect(firstCart.body.itemCount).toBe(1);
    expect(secondCart.body.itemCount).toBe(0);
    expect(firstCart.body.id).not.toBe(secondCart.body.id);
  });

  it("merges a guest cart once and repeated merge does not duplicate quantity", async () => {
    const guest = request.agent(app.getHttpServer());
    const initial = await guest.get("/api/v1/cart").expect(200);
    const rawSetCookie = initial.headers["set-cookie"];
    const guestCookie = (
      Array.isArray(rawSetCookie) ? rawSetCookie : [rawSetCookie]
    )
      .find((value) => value?.startsWith("farta_guest_cart="))
      ?.split(";", 1)[0];
    expect(guestCookie).toBeTruthy();
    await guest
      .post("/api/v1/cart/items")
      .set("origin", origin)
      .send({ variantId, quantity: 2 })
      .expect(201);

    const customer = await register("cart-merge@example.test");
    await customer.agent
      .post("/api/v1/cart/items")
      .set("origin", origin)
      .set("x-csrf-token", customer.csrfToken)
      .send({ variantId, quantity: 1 })
      .expect(201);

    const mergeRequest = () =>
      request(app.getHttpServer())
        .post("/api/v1/cart/merge")
        .set("Cookie", `${customer.cookieHeader}; ${guestCookie ?? ""}`)
        .set("origin", origin)
        .set("x-csrf-token", customer.csrfToken);
    const concurrent = await Promise.all([mergeRequest(), mergeRequest()]);
    expect(concurrent.map(({ status }) => status)).toEqual([201, 201]);
    expect(concurrent.map(({ body }) => body.itemCount)).toEqual([3, 3]);

    const replay = await customer.agent
      .post("/api/v1/cart/merge")
      .set("Cookie", `${customer.cookieHeader}; ${guestCookie ?? ""}`)
      .set("origin", origin)
      .set("x-csrf-token", customer.csrfToken)
      .expect(201);
    expect(replay.body.itemCount).toBe(3);
  });

  it("does not reserve inventory when adding to cart", async () => {
    const before = await mongo.db
      ?.collection("inventory")
      .findOne({ variantId: new Types.ObjectId(variantId) });
    const guest = request.agent(app.getHttpServer());
    await guest
      .post("/api/v1/cart/items")
      .set("origin", origin)
      .send({ variantId, quantity: 1 })
      .expect(201);
    const after = await mongo.db
      ?.collection("inventory")
      .findOne({ variantId: new Types.ObjectId(variantId) });
    expect(after?.reserved).toBe(before?.reserved);
    expect(
      await mongo.db?.collection("inventory_transactions").countDocuments(),
    ).toBe(0);
  });

  it("stores only a guest credential digest", async () => {
    const guest = request.agent(app.getHttpServer());
    const response = await guest.get("/api/v1/cart").expect(200);
    const serialized = JSON.stringify(
      await mongo.db
        ?.collection("carts")
        .findOne({ _id: new Types.ObjectId(response.body.id as string) }),
    );
    expect(serialized).toContain("guestCredentialDigest");
    expect(serialized).not.toContain("farta_guest_cart");
  });
});
