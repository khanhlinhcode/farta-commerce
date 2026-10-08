import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getConnectionToken } from "@nestjs/mongoose";
import Redis from "ioredis";
import type { Connection } from "mongoose";
import { Types } from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { configureHttpApplication } from "../src/configure-http-app";
import { OrdersService } from "../src/orders/orders.service";
import { ReservationsService } from "../src/reservations/reservations.service";

const origin = "http://localhost:3000";
const redisUrl = "redis://localhost:6379/14";

describe("Phase 4B checkout, reservation, order and COD", () => {
  let app: INestApplication;
  let mongo: Connection;
  let productId: Types.ObjectId;
  let standardVariantId: string;
  let raceVariantId: string;
  let rollbackVariantId: string;
  let expiryVariantId: string;

  beforeAll(async () => {
    Object.assign(process.env, {
      APP_ENV: "test",
      PORT: "4000",
      APP_ORIGIN: origin,
      ADMIN_ORIGIN: "http://localhost:5173",
      API_ORIGIN: "http://localhost:4000",
      MONGODB_URI:
        "mongodb://localhost:27017/farta_checkout_e2e?replicaSet=rs0&directConnection=true",
      REDIS_URL: redisUrl,
      JWT_ACCESS_SECRET: "a".repeat(32),
      JWT_REFRESH_SECRET: "b".repeat(32),
      CSRF_SECRET: "c".repeat(32),
      CART_CREDENTIAL_SECRET: "d".repeat(32),
      ORDER_LOOKUP_SECRET: "e".repeat(32),
      JWT_ISSUER: "farta-api-test",
      JWT_CUSTOMER_AUDIENCE: "farta-storefront-test",
      JWT_STAFF_AUDIENCE: "farta-admin-test",
      JWT_ACCESS_TTL_SECONDS: "300",
      SESSION_IDLE_TTL_SECONDS: "3600",
      SESSION_ABSOLUTE_TTL_SECONDS: "7200",
      BCRYPT_COST: "10",
      AUTH_LOGIN_LIMIT: "100",
      AUTH_LOGIN_WINDOW_SECONDS: "300",
      AUTH_REFRESH_LIMIT: "300",
      AUTH_REFRESH_WINDOW_SECONDS: "300",
      CART_MAX_ITEM_QUANTITY: "10",
      GUEST_CART_TTL_SECONDS: "2592000",
      CUSTOMER_CART_TTL_SECONDS: "7776000",
      CART_MUTATION_LIMIT: "300",
      CART_MUTATION_WINDOW_SECONDS: "300",
      CART_MERGE_LIMIT: "300",
      CART_MERGE_WINDOW_SECONDS: "300",
      CHECKOUT_RESERVATION_TTL_SECONDS: "900",
      SHIPPING_FLAT_FEE_VND: "30000",
      FREE_SHIPPING_THRESHOLD_VND: "1000000",
      CHECKOUT_LIMIT: "300",
      CHECKOUT_WINDOW_SECONDS: "300",
      ORDER_LOOKUP_LIMIT: "5",
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
    app.getHttpServer().setMaxListeners(256);
    configureHttpApplication(app, { requestLogging: false });
    await app.init();
    mongo = app.get<Connection>(getConnectionToken());
    await mongo.db?.dropDatabase();
    await Promise.all(
      Object.values(mongo.models).map((model) => model.syncIndexes()),
    );

    const actorId = new Types.ObjectId();
    productId = new Types.ObjectId();
    const mediaId = new Types.ObjectId();
    const now = new Date();
    await mongo.db?.collection("media_assets").insertOne({
      _id: mediaId,
      provider: "CLOUDINARY",
      publicId: "farta/test/checkout-cover",
      secureUrl:
        "https://res.cloudinary.com/farta-test/image/upload/checkout-cover.jpg",
      resourceType: "image",
      format: "jpg",
      width: 1000,
      height: 1250,
      bytes: 1000,
      originalFilename: "checkout-cover.jpg",
      altText: "FARTA Checkout Tee",
      createdBy: actorId,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    await mongo.db?.collection("products").insertOne({
      _id: productId,
      name: "FARTA Checkout Tee",
      slug: "farta-checkout-tee",
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

    const variants = [
      { sku: "FAR-CHECKOUT-STD-M", stock: 20 },
      { sku: "FAR-CHECKOUT-RACE-M", stock: 1 },
      { sku: "FAR-CHECKOUT-ROLL-M", stock: 1 },
      { sku: "FAR-CHECKOUT-EXP-M", stock: 1 },
    ].map((definition) => ({ ...definition, _id: new Types.ObjectId() }));
    standardVariantId = variants[0]!._id.toString();
    raceVariantId = variants[1]!._id.toString();
    rollbackVariantId = variants[2]!._id.toString();
    expiryVariantId = variants[3]!._id.toString();
    await mongo.db?.collection("product_variants").insertMany(
      variants.map((variant) => ({
        _id: variant._id,
        productId,
        sku: variant.sku,
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
      })),
    );
    await mongo.db?.collection("inventory").insertMany(
      variants.map((variant) => ({
        variantId: variant._id,
        onHand: variant.stock,
        reserved: 0,
        createdAt: now,
        updatedAt: now,
      })),
    );
  }, 30_000);

  afterAll(async () => {
    await mongo?.db?.dropDatabase();
    await app?.close();
  });

  const checkoutBody = (quoteToken: string) => ({
    recipientName: "Linh To",
    phone: "0912 345 678",
    addressLine: "12 Nguyen Hue",
    provinceCity: "Ho Chi Minh City",
    district: "District 1",
    ward: "Ben Nghe",
    shippingMethod: "STANDARD",
    paymentMethod: "COD",
    notes: "Call before delivery",
    quoteToken,
  });

  async function guestCart(variantId: string) {
    const agent = request.agent(app.getHttpServer());
    await agent.get("/api/v1/cart").expect(200);
    await agent
      .post("/api/v1/cart/items")
      .set("origin", origin)
      .send({ variantId, quantity: 1 })
      .expect(201);
    const preview = await agent
      .post("/api/v1/checkout/preview")
      .set("origin", origin)
      .send({})
      .expect(201);
    return {
      agent,
      preview: preview.body as { quoteToken: string; total: number },
    };
  }

  async function register(email: string) {
    const agent = request.agent(app.getHttpServer());
    const csrf = await agent.get("/api/v1/auth/customer/csrf").expect(200);
    const registered = await agent
      .post("/api/v1/auth/customer/register")
      .set("origin", origin)
      .set("x-csrf-token", csrf.body.csrfToken as string)
      .send({
        email,
        password: "a secure checkout test password",
        displayName: "Checkout Customer",
      })
      .expect(201);
    return {
      agent,
      csrfToken: registered.body.csrfToken as string,
    };
  }

  it("creates an authoritative COD order with immutable snapshots", async () => {
    const { agent, preview } = await guestCart(standardVariantId);
    expect(preview.total).toBe(329000);
    const order = await agent
      .post("/api/v1/checkout")
      .set("origin", origin)
      .set("idempotency-key", "checkout-basic-key-0001")
      .send(checkoutBody(preview.quoteToken))
      .expect(201);
    expect(order.body).toMatchObject({
      status: "CREATED",
      paymentStatus: "UNPAID",
      paymentMethod: "COD",
      itemsSubtotal: 299000,
      shippingFee: 30000,
      total: 329000,
      payment: {
        provider: "COD",
        status: "UNPAID",
        codAmount: 329000,
        codCollectedAt: null,
      },
    });
    expect(order.body.orderCode).toMatch(/^FAR-[0-9]{8}-[A-Z2-9]{10}$/);
    expect(order.body.items[0]).toMatchObject({
      productName: "FARTA Checkout Tee",
      sku: "FAR-CHECKOUT-STD-M",
      unitPrice: 299000,
    });

    const reservation = await mongo.db
      ?.collection("inventory_reservations")
      .findOne({ referenceId: new Types.ObjectId(order.body.id as string) });
    expect(reservation?.status).toBe("CONFIRMED");
    const inventory = await mongo.db
      ?.collection("inventory")
      .findOne({ variantId: new Types.ObjectId(standardVariantId) });
    expect(inventory?.reserved).toBe(1);

    const guestRead = await agent
      .get(`/api/v1/orders/${order.body.orderCode as string}`)
      .expect(200);
    expect(guestRead.body.orderCode).toBe(order.body.orderCode);
    await request(app.getHttpServer())
      .post("/api/v1/orders/lookup")
      .send({ orderCode: order.body.orderCode, phone: "0999999999" })
      .expect(404);
    const lookup = await request(app.getHttpServer())
      .post("/api/v1/orders/lookup")
      .send({ orderCode: order.body.orderCode, phone: "0912345678" })
      .expect(201);
    expect(lookup.body.orderCode).toBe(order.body.orderCode);
    expect(lookup.body).not.toHaveProperty("shipping");
    expect(lookup.body).not.toHaveProperty("payment");
    expect(lookup.body).not.toHaveProperty("id");
    expect(lookup.body.items[0]).not.toHaveProperty("productId");
    expect(lookup.body.items[0]).not.toHaveProperty("variantId");
    expect(lookup.body.items[0]).not.toHaveProperty("sku");
  });

  it("makes duplicate checkout submission one logical order", async () => {
    const { agent, preview } = await guestCart(standardVariantId);
    const submit = () =>
      agent
        .post("/api/v1/checkout")
        .set("origin", origin)
        .set("idempotency-key", "checkout-double-click-0001")
        .send(checkoutBody(preview.quoteToken));
    const [first, second] = await Promise.all([submit(), submit()]);
    expect([first.status, second.status]).toEqual([201, 201]);
    expect(first.body.id).toBe(second.body.id);
    expect(
      await mongo.db?.collection("orders").countDocuments({
        _id: new Types.ObjectId(first.body.id as string),
      }),
    ).toBe(1);
    expect(
      await mongo.db?.collection("notification_events").countDocuments({
        aggregateId: new Types.ObjectId(first.body.id as string),
        type: "ORDER_CREATED",
      }),
    ).toBe(1);
  });

  it("rejects a stale price quote before reserving inventory", async () => {
    const { agent, preview } = await guestCart(standardVariantId);
    const before = await mongo.db
      ?.collection("inventory")
      .findOne({ variantId: new Types.ObjectId(standardVariantId) });
    await mongo.db
      ?.collection("product_variants")
      .updateOne(
        { _id: new Types.ObjectId(standardVariantId) },
        { $set: { price: 319000 } },
      );
    await agent
      .post("/api/v1/checkout")
      .set("origin", origin)
      .set("idempotency-key", "checkout-stale-price-0001")
      .send(checkoutBody(preview.quoteToken))
      .expect(409);
    const after = await mongo.db
      ?.collection("inventory")
      .findOne({ variantId: new Types.ObjectId(standardVariantId) });
    expect(after?.reserved).toBe(before?.reserved);
    await mongo.db
      ?.collection("product_variants")
      .updateOne(
        { _id: new Types.ObjectId(standardVariantId) },
        { $set: { price: 299000 } },
      );
  });

  it("rate limits repeated guest order lookup attempts", async () => {
    const redis = new Redis(redisUrl);
    await redis.flushdb();
    await redis.quit();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app.getHttpServer())
        .post("/api/v1/orders/lookup")
        .send({ orderCode: "FAR-20260101-AAAAAAAAAA", phone: "0912345678" })
        .expect(404);
    }
    await request(app.getHttpServer())
      .post("/api/v1/orders/lookup")
      .send({ orderCode: "FAR-20260101-AAAAAAAAAA", phone: "0912345678" })
      .expect(429);
  });

  it("rejects idempotency reuse with a different request and client authority fields", async () => {
    const { agent, preview } = await guestCart(standardVariantId);
    await agent
      .post("/api/v1/checkout")
      .set("origin", origin)
      .set("idempotency-key", "checkout-key-reuse-0001")
      .send(checkoutBody(preview.quoteToken))
      .expect(201);
    await agent
      .post("/api/v1/checkout")
      .set("origin", origin)
      .set("idempotency-key", "checkout-key-reuse-0001")
      .send({ ...checkoutBody(preview.quoteToken), notes: "changed" })
      .expect(409);

    const other = await guestCart(standardVariantId);
    await other.agent
      .post("/api/v1/checkout")
      .set("origin", origin)
      .set("idempotency-key", "checkout-tamper-key-0001")
      .send({
        ...checkoutBody(other.preview.quoteToken),
        total: 1,
        customerId: new Types.ObjectId().toString(),
        paymentStatus: "FULLY_PAID",
      })
      .expect(400);
  });

  it("rolls back inventory, ledger, reservation and order on transaction failure", async () => {
    const { agent, preview } = await guestCart(rollbackVariantId);
    const orders = app.get(OrdersService);
    const create = vi
      .spyOn(orders, "create")
      .mockRejectedValueOnce(new Error("intentional rollback test"));
    await agent
      .post("/api/v1/checkout")
      .set("origin", origin)
      .set("idempotency-key", "checkout-rollback-key-0001")
      .send(checkoutBody(preview.quoteToken))
      .expect(500);
    create.mockRestore();

    const inventory = await mongo.db
      ?.collection("inventory")
      .findOne({ variantId: new Types.ObjectId(rollbackVariantId) });
    expect(inventory?.reserved).toBe(0);
    expect(
      await mongo.db?.collection("inventory_reservations").countDocuments({
        variantId: new Types.ObjectId(rollbackVariantId),
      }),
    ).toBe(0);
    expect(
      await mongo.db?.collection("inventory_transactions").countDocuments({
        variantId: new Types.ObjectId(rollbackVariantId),
      }),
    ).toBe(0);
  });

  it("expires an active reservation once and never double releases", async () => {
    const reservationId = new Types.ObjectId();
    await mongo.db
      ?.collection("inventory")
      .updateOne(
        { variantId: new Types.ObjectId(expiryVariantId) },
        { $set: { reserved: 1 } },
      );
    await mongo.db?.collection("inventory_reservations").insertOne({
      _id: reservationId,
      variantId: new Types.ObjectId(expiryVariantId),
      quantity: 1,
      cartId: new Types.ObjectId(),
      customerId: null,
      guestOwnerDigest: "test-guest-digest",
      status: "ACTIVE",
      expiresAt: new Date(Date.now() - 1000),
      confirmedAt: null,
      releasedAt: null,
      referenceType: null,
      referenceId: null,
      idempotencyRecordId: new Types.ObjectId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const reservations = app.get(ReservationsService);
    expect(await reservations.expireDue(10, "expiry-test-1")).toBe(1);
    expect(await reservations.expireDue(10, "expiry-test-2")).toBe(0);
    const inventory = await mongo.db
      ?.collection("inventory")
      .findOne({ variantId: new Types.ObjectId(expiryVariantId) });
    expect(inventory?.reserved).toBe(0);
    expect(
      await mongo.db?.collection("inventory_transactions").countDocuments({
        variantId: new Types.ObjectId(expiryVariantId),
        type: "RELEASE",
      }),
    ).toBe(1);
  });

  it("releases an explicit reservation idempotently", async () => {
    const reservationId = new Types.ObjectId();
    await mongo.db
      ?.collection("inventory")
      .updateOne(
        { variantId: new Types.ObjectId(rollbackVariantId) },
        { $set: { reserved: 1 } },
      );
    await mongo.db?.collection("inventory_reservations").insertOne({
      _id: reservationId,
      variantId: new Types.ObjectId(rollbackVariantId),
      quantity: 1,
      cartId: new Types.ObjectId(),
      customerId: null,
      guestOwnerDigest: "release-guest-digest",
      status: "CONFIRMED",
      expiresAt: new Date(Date.now() + 60_000),
      confirmedAt: new Date(),
      releasedAt: null,
      referenceType: "ORDER",
      referenceId: new Types.ObjectId(),
      idempotencyRecordId: new Types.ObjectId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const reservations = app.get(ReservationsService);
    const command = {
      requestId: "explicit-release-test",
      actorId: null,
      reason: "Explicit release test.",
    };
    expect(
      await reservations.release([reservationId.toString()], command),
    ).toBe(1);
    expect(
      await reservations.release([reservationId.toString()], command),
    ).toBe(0);
    const inventory = await mongo.db
      ?.collection("inventory")
      .findOne({ variantId: new Types.ObjectId(rollbackVariantId) });
    expect(inventory?.reserved).toBe(0);
  });

  it("enforces customer order BOLA and session CSRF", async () => {
    const customerA = await register("checkout-a@example.com");
    const customerB = await register("checkout-b@example.com");
    await customerA.agent
      .post("/api/v1/cart/items")
      .set("origin", origin)
      .set("x-csrf-token", customerA.csrfToken)
      .send({ variantId: standardVariantId, quantity: 1 })
      .expect(201);
    const preview = await customerA.agent
      .post("/api/v1/checkout/preview")
      .set("origin", origin)
      .set("x-csrf-token", customerA.csrfToken)
      .send({})
      .expect(201);
    await customerA.agent
      .post("/api/v1/checkout")
      .set("origin", origin)
      .set("idempotency-key", "checkout-customer-a-0001")
      .send(checkoutBody(preview.body.quoteToken as string))
      .expect(403);
    const order = await customerA.agent
      .post("/api/v1/checkout")
      .set("origin", origin)
      .set("x-csrf-token", customerA.csrfToken)
      .set("idempotency-key", "checkout-customer-a-0001")
      .send(checkoutBody(preview.body.quoteToken as string))
      .expect(201);
    await customerB.agent
      .get(`/api/v1/orders/${order.body.orderCode as string}`)
      .expect(404);
    const redis = new Redis(redisUrl);
    await redis.flushdb();
    await redis.quit();
    await request(app.getHttpServer())
      .post("/api/v1/orders/lookup")
      .send({ orderCode: order.body.orderCode, phone: "0912345678" })
      .expect(404);
    await customerA.agent
      .patch(`/api/v1/orders/${order.body.orderCode as string}`)
      .set("origin", origin)
      .set("x-csrf-token", customerA.csrfToken)
      .send({ status: "COMPLETED" })
      .expect(404);
  });

  it("allows exactly one of 100 concurrent checkouts for the final unit", async () => {
    const checkouts = await Promise.all(
      Array.from({ length: 100 }, () => guestCart(raceVariantId)),
    );
    const results = await Promise.all(
      checkouts.map(({ agent, preview }, index) =>
        agent
          .post("/api/v1/checkout")
          .set("origin", origin)
          .set(
            "idempotency-key",
            `race-checkout-key-${String(index).padStart(4, "0")}`,
          )
          .send(checkoutBody(preview.quoteToken)),
      ),
    );
    expect(results.filter((result) => result.status === 201)).toHaveLength(1);
    expect(results.filter((result) => result.status === 409)).toHaveLength(99);
    const inventory = await mongo.db
      ?.collection("inventory")
      .findOne({ variantId: new Types.ObjectId(raceVariantId) });
    expect(inventory).toMatchObject({ onHand: 1, reserved: 1 });
    expect(
      await mongo.db?.collection("inventory_reservations").countDocuments({
        variantId: new Types.ObjectId(raceVariantId),
        status: "CONFIRMED",
      }),
    ).toBe(1);
  }, 60_000);
});
