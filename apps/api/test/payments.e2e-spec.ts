import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getConnectionToken } from "@nestjs/mongoose";
import { createHmac } from "node:crypto";
import Redis from "ioredis";
import type { Connection } from "mongoose";
import { Types } from "mongoose";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { configureHttpApplication } from "../src/configure-http-app";

const origin = "http://localhost:3000";
const redisUrl = "redis://localhost:6379/13";
const webhookSecret = "s".repeat(32);

describe("Phase 4C SePay payment and webhook integrity", () => {
  let app: INestApplication;
  let mongo: Connection;
  let variantId: string;
  let eventSequence = 10_000;

  beforeAll(async () => {
    Object.assign(process.env, {
      APP_ENV: "test",
      PORT: "4000",
      APP_ORIGIN: origin,
      ADMIN_ORIGIN: "http://localhost:5173",
      API_ORIGIN: "http://localhost:4000",
      MONGODB_URI:
        "mongodb://localhost:27017/farta_payment_e2e?replicaSet=rs0&directConnection=true",
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
      ORDER_LOOKUP_LIMIT: "100",
      ORDER_LOOKUP_WINDOW_SECONDS: "300",
      PAYMENT_INITIATE_LIMIT: "20",
      PAYMENT_INITIATE_GLOBAL_LIMIT: "300",
      PAYMENT_INITIATE_WINDOW_SECONDS: "300",
      PAYMENT_STATUS_LIMIT: "120",
      PAYMENT_STATUS_GLOBAL_LIMIT: "125",
      PAYMENT_STATUS_WINDOW_SECONDS: "300",
      SEPAY_ENABLED: "true",
      SEPAY_BANK_NAME: "TestBank",
      SEPAY_ACCOUNT_NUMBER: "0123456789",
      SEPAY_ACCOUNT_HOLDER: "FARTA TEST",
      SEPAY_WEBHOOK_SECRET: webhookSecret,
      SEPAY_WEBHOOK_TOLERANCE_SECONDS: "300",
      SEPAY_PAYMENT_CODE_PREFIX: "FAR",
      SEPAY_DEPOSIT_MODE: "FIXED",
      SEPAY_DEPOSIT_FIXED_VND: "100000",
      SEPAY_DEPOSIT_BASIS_POINTS: "",
    });
    const redis = new Redis(redisUrl);
    await redis.flushdb();
    await redis.quit();
    const { AppModule } = await import("../src/app.module");
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    configureHttpApplication(app, { requestLogging: false });
    await app.init();
    mongo = app.get<Connection>(getConnectionToken());
    await mongo.db?.dropDatabase();
    await Promise.all(
      Object.values(mongo.models).map((model) => model.syncIndexes()),
    );

    const actorId = new Types.ObjectId();
    const productId = new Types.ObjectId();
    const mediaId = new Types.ObjectId();
    const variantObjectId = new Types.ObjectId();
    variantId = variantObjectId.toString();
    const now = new Date();
    await mongo.db?.collection("media_assets").insertOne({
      _id: mediaId,
      provider: "CLOUDINARY",
      publicId: "farta/test/payment-cover",
      secureUrl:
        "https://res.cloudinary.com/farta-test/image/upload/payment-cover.jpg",
      resourceType: "image",
      format: "jpg",
      width: 1000,
      height: 1250,
      bytes: 1000,
      originalFilename: "payment-cover.jpg",
      altText: "FARTA Payment Tee",
      createdBy: actorId,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    await mongo.db?.collection("products").insertOne({
      _id: productId,
      name: "FARTA Payment Tee",
      slug: "farta-payment-tee",
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
      sku: "FAR-PAYMENT-BLK-M",
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
      onHand: 50,
      reserved: 0,
      createdAt: now,
      updatedAt: now,
    });
  }, 30_000);

  afterAll(async () => {
    await mongo?.db?.dropDatabase();
    await app?.close();
  });

  afterEach(async () => {
    const redis = new Redis(redisUrl);
    const keys = await redis.keys("rate:PAYMENT_STATUS:*");
    if (keys.length > 0) await redis.del(...keys);
    await redis.quit();
  });

  async function onlineCheckout(method: "DEPOSIT" | "FULL" = "FULL") {
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
    expect(preview.body.supportedPaymentMethods).toEqual([
      "COD",
      "FULL",
      "DEPOSIT",
    ]);
    const order = await agent
      .post("/api/v1/checkout")
      .set("origin", origin)
      .set("idempotency-key", `payment-checkout-${eventSequence++}`)
      .send({
        recipientName: "Linh To",
        phone: "0912 345 678",
        addressLine: "12 Nguyen Hue",
        provinceCity: "Ho Chi Minh City",
        district: "District 1",
        ward: "Ben Nghe",
        shippingMethod: "STANDARD",
        paymentMethod: method,
        notes: "SePay test",
        quoteToken: preview.body.quoteToken,
      })
      .expect(201);
    return { agent, order: order.body };
  }

  function webhookPayload(
    reference: string,
    amount: number,
    overrides: Record<string, unknown> = {},
  ) {
    return {
      id: eventSequence++,
      gateway: "TestBank",
      transactionDate: "2026-10-08 10:00:00",
      accountNumber: "0123456789",
      subAccount: "",
      code: reference,
      content: `${reference} payment`,
      transferType: "in",
      description: "FARTA test transfer",
      transferAmount: amount,
      accumulated: 1_000_000,
      referenceCode: `TEST-${eventSequence}`,
      ...overrides,
    };
  }

  function sendWebhook(
    payload: Record<string, unknown>,
    options: { secret?: string; timestamp?: number; signature?: string } = {},
  ) {
    const raw = JSON.stringify(payload);
    const timestamp = String(
      options.timestamp ?? Math.floor(Date.now() / 1000),
    );
    const signature =
      options.signature ??
      `sha256=${createHmac("sha256", options.secret ?? webhookSecret)
        .update(`${timestamp}.${raw}`)
        .digest("hex")}`;
    return request(app.getHttpServer())
      .post("/api/v1/webhooks/sepay")
      .set("content-type", "application/json")
      .set("x-sepay-timestamp", timestamp)
      .set("x-sepay-signature", signature)
      .send(raw);
  }

  it("creates real server-driven full payment instructions without marking paid", async () => {
    const { agent, order } = await onlineCheckout("FULL");
    expect(order).toMatchObject({
      status: "CREATED",
      paymentStatus: "UNPAID",
      paymentMethod: "FULL",
      payment: { provider: "SEPAY", expectedAmount: 329000 },
    });
    const first = await agent
      .post(`/api/v1/payments/${order.orderCode}/initiate`)
      .set("origin", origin)
      .expect(201);
    const retry = await agent
      .post(`/api/v1/payments/${order.orderCode}/initiate`)
      .set("origin", origin)
      .expect(201);
    expect(retry.body.instructions).toEqual(first.body.instructions);
    expect(first.body.instructions).toMatchObject({
      provider: "SEPAY",
      method: "FULL",
      amount: 329000,
      currency: "VND",
      bank: { name: "TestBank", accountNumber: "0123456789" },
    });
    expect(first.body.instructions.qrUrl).toMatch(
      /^https:\/\/vietqr\.app\/img\?/,
    );
    expect(
      await mongo.db?.collection("payments").countDocuments({
        orderId: new Types.ObjectId(order.id as string),
      }),
    ).toBe(1);
    const status = await agent
      .get(`/api/v1/payments/${order.orderCode}/status`)
      .expect(200);
    expect(status.body.status).toBe("UNPAID");
    await mongo.db
      ?.collection("payments")
      .updateOne(
        { orderId: new Types.ObjectId(order.id as string) },
        { $set: { status: "FAILED" } },
      );
    await agent
      .post(`/api/v1/payments/${order.orderCode}/initiate`)
      .set("origin", origin)
      .expect(409);
  });

  it("accepts a valid full-payment webhook and confirms reservation once", async () => {
    const { order } = await onlineCheckout("FULL");
    const payload = webhookPayload(order.payment.reference, 329000);
    await sendWebhook(payload).expect(200, { success: true });
    const payment = await mongo.db
      ?.collection("payments")
      .findOne({ orderId: new Types.ObjectId(order.id as string) });
    const storedOrder = await mongo.db
      ?.collection("orders")
      .findOne({ _id: new Types.ObjectId(order.id as string) });
    const reservation = await mongo.db
      ?.collection("inventory_reservations")
      .findOne({ referenceId: new Types.ObjectId(order.id as string) });
    expect(payment).toMatchObject({
      status: "FULLY_PAID",
      receivedAmount: 329000,
    });
    expect(storedOrder).toMatchObject({
      status: "CONFIRMED",
      paymentStatus: "FULLY_PAID",
    });
    expect(reservation?.status).toBe("CONFIRMED");
  });

  it("rejects invalid signatures and stale timestamps without persistence", async () => {
    const before = await mongo.db
      ?.collection("payment_webhook_events")
      .countDocuments({});
    await sendWebhook(webhookPayload("FARUNKNOWN", 329000), {
      signature: `sha256=${"0".repeat(64)}`,
    }).expect(401);
    await sendWebhook(webhookPayload("FARUNKNOWN", 329000), {
      timestamp: Math.floor(Date.now() / 1000) - 301,
    }).expect(401);
    expect(
      await mongo.db?.collection("payment_webhook_events").countDocuments({}),
    ).toBe(before);
  });

  it("deduplicates concurrent replay of the same provider event", async () => {
    const { order } = await onlineCheckout("FULL");
    const payload = webhookPayload(order.payment.reference, 329000);
    const responses = await Promise.all([
      sendWebhook(payload),
      sendWebhook(payload),
      sendWebhook(payload),
    ]);
    expect(responses.map((response) => response.status)).toEqual([
      200, 200, 200,
    ]);
    expect(
      await mongo.db?.collection("payment_webhook_events").countDocuments({
        provider: "SEPAY",
        eventId: String(payload.id),
      }),
    ).toBe(1);
    const payment = await mongo.db
      ?.collection("payments")
      .findOne({ orderId: new Types.ObjectId(order.id as string) });
    expect(payment?.providerTransactionIds).toEqual([String(payload.id)]);
  });

  it("rejects a reused provider event ID when the signed payload differs", async () => {
    const { order } = await onlineCheckout("FULL");
    const accepted = webhookPayload(order.payment.reference, 329000);
    await sendWebhook(accepted).expect(200, { success: true });
    const mismatchedReplay = {
      ...accepted,
      transferAmount: 100000,
      referenceCode: "MISMATCHED-REPLAY",
    };
    await sendWebhook(mismatchedReplay).expect(409);
    const event = await mongo.db
      ?.collection("payment_webhook_events")
      .findOne({ provider: "SEPAY", eventId: String(accepted.id) });
    const payment = await mongo.db
      ?.collection("payments")
      .findOne({ orderId: new Types.ObjectId(order.id as string) });
    expect(event?.replayMismatchCount).toBe(1);
    expect(event?.lastReplayMismatchAt).toBeInstanceOf(Date);
    expect(payment?.status).toBe("FULLY_PAID");
  });

  it("moves amount mismatch into explicit payment conflict", async () => {
    const { order } = await onlineCheckout("FULL");
    const payload = webhookPayload(order.payment.reference, 100000);
    await sendWebhook(payload).expect(200, { success: true });
    const payment = await mongo.db
      ?.collection("payments")
      .findOne({ orderId: new Types.ObjectId(order.id as string) });
    const storedOrder = await mongo.db
      ?.collection("orders")
      .findOne({ _id: new Types.ObjectId(order.id as string) });
    expect(payment).toMatchObject({
      status: "CONFLICT",
      providerTransactionId: String(payload.id),
      providerTransactionIds: [String(payload.id)],
      providerPayloadSafeSummary: {
        amount: 100000,
        accountSuffix: "6789",
      },
    });
    expect(storedOrder).toMatchObject({
      status: "PAYMENT_CONFLICT",
      paymentStatus: "CONFLICT",
    });
  });

  it("rejects an undocumented currency field instead of guessing semantics", async () => {
    const { order } = await onlineCheckout("FULL");
    const payload = webhookPayload(order.payment.reference, 329000, {
      currency: "USD",
    });
    await sendWebhook(payload).expect(400);
    expect(
      await mongo.db?.collection("payment_webhook_events").countDocuments({
        eventId: String(payload.id),
      }),
    ).toBe(0);
  });

  it("records account mismatch and unknown references for reconciliation", async () => {
    const { order } = await onlineCheckout("FULL");
    const mismatch = webhookPayload(order.payment.reference, 329000, {
      accountNumber: "0000000000",
    });
    const unknown = webhookPayload("FARUNKNOWNREFERENCE", 329000);
    await sendWebhook(mismatch).expect(200, { success: true });
    await sendWebhook(unknown).expect(200, { success: true });
    const events = await mongo.db
      ?.collection("payment_webhook_events")
      .find({ eventId: { $in: [String(mismatch.id), String(unknown.id)] } })
      .toArray();
    expect(events?.map((event) => event.outcomeCode).sort()).toEqual([
      "PAYMENT_ACCOUNT_MISMATCH",
      "UNKNOWN_PAYMENT_REFERENCE",
    ]);
  });

  it("keeps progressed fulfillment state but synchronizes payment conflict", async () => {
    const { order } = await onlineCheckout("FULL");
    await sendWebhook(webhookPayload(order.payment.reference, 329000)).expect(
      200,
      { success: true },
    );
    await mongo.db
      ?.collection("orders")
      .updateOne(
        { _id: new Types.ObjectId(order.id as string) },
        { $set: { status: "PACKING" } },
      );
    await sendWebhook(webhookPayload(order.payment.reference, 329000)).expect(
      200,
      { success: true },
    );
    const storedOrder = await mongo.db
      ?.collection("orders")
      .findOne({ _id: new Types.ObjectId(order.id as string) });
    const payment = await mongo.db
      ?.collection("payments")
      .findOne({ orderId: new Types.ObjectId(order.id as string) });
    expect(storedOrder).toMatchObject({
      status: "PACKING",
      paymentStatus: "CONFLICT",
    });
    expect(payment?.status).toBe("CONFLICT");
  });

  it("records a post-refund event without corrupting settled domain state", async () => {
    const { order } = await onlineCheckout("FULL");
    await mongo.db
      ?.collection("payments")
      .updateOne(
        { orderId: new Types.ObjectId(order.id as string) },
        { $set: { status: "REFUNDED" } },
      );
    await mongo.db
      ?.collection("orders")
      .updateOne(
        { _id: new Types.ObjectId(order.id as string) },
        { $set: { paymentStatus: "REFUNDED" } },
      );
    const payload = webhookPayload(order.payment.reference, 329000);
    await sendWebhook(payload).expect(200, { success: true });
    const storedOrder = await mongo.db
      ?.collection("orders")
      .findOne({ _id: new Types.ObjectId(order.id as string) });
    const payment = await mongo.db
      ?.collection("payments")
      .findOne({ orderId: new Types.ObjectId(order.id as string) });
    const event = await mongo.db
      ?.collection("payment_webhook_events")
      .findOne({ eventId: String(payload.id) });
    expect(storedOrder?.paymentStatus).toBe("REFUNDED");
    expect(payment?.status).toBe("REFUNDED");
    expect(event).toMatchObject({
      status: "CONFLICT",
      outcomeCode: "PAYMENT_STATE_CONFLICT",
    });
  });

  it("handles deposit then exact remaining full payment", async () => {
    const { agent, order } = await onlineCheckout("DEPOSIT");
    expect(order.payment.expectedAmount).toBe(100000);
    await sendWebhook(webhookPayload(order.payment.reference, 100000)).expect(
      200,
      { success: true },
    );
    const depositStatus = await agent
      .get(`/api/v1/payments/${order.orderCode}/status`)
      .expect(200);
    expect(depositStatus.body).toMatchObject({
      status: "DEPOSIT_PAID",
      receivedAmount: 100000,
      amountDue: 229000,
    });
    await sendWebhook(webhookPayload(order.payment.reference, 229000)).expect(
      200,
      { success: true },
    );
    const fullStatus = await agent
      .get(`/api/v1/payments/${order.orderCode}/status`)
      .expect(200);
    expect(fullStatus.body).toMatchObject({
      status: "FULLY_PAID",
      receivedAmount: 329000,
      amountDue: 0,
    });
  });

  it("does not trust browser initiation or status polling as payment success", async () => {
    const { agent, order } = await onlineCheckout("FULL");
    await agent
      .post(`/api/v1/payments/${order.orderCode}/initiate`)
      .set("origin", origin)
      .expect(201);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const status = await agent
        .get(`/api/v1/payments/${order.orderCode}/status`)
        .expect(200);
      expect(status.body.status).toBe("UNPAID");
    }
  });

  it("supports the bounded five-minute polling budget per order", async () => {
    const { agent, order } = await onlineCheckout("FULL");
    for (let attempt = 0; attempt < 120; attempt += 1) {
      await agent.get(`/api/v1/payments/${order.orderCode}/status`).expect(200);
    }
    await agent.get(`/api/v1/payments/${order.orderCode}/status`).expect(429);
  });

  it("applies a source-global budget across rotated order codes", async () => {
    const first = await onlineCheckout("FULL");
    const second = await onlineCheckout("FULL");
    for (let attempt = 0; attempt < 62; attempt += 1) {
      await first.agent
        .get(`/api/v1/payments/${first.order.orderCode}/status`)
        .expect(200);
      await second.agent
        .get(`/api/v1/payments/${second.order.orderCode}/status`)
        .expect(200);
    }
    await first.agent
      .get(`/api/v1/payments/${first.order.orderCode}/status`)
      .expect(200);
    await second.agent
      .get(`/api/v1/payments/${second.order.orderCode}/status`)
      .expect(429);
  });

  it("marks payment after reservation expiry as a conflict", async () => {
    const { order } = await onlineCheckout("FULL");
    await mongo.db
      ?.collection("inventory_reservations")
      .updateMany(
        { referenceId: new Types.ObjectId(order.id as string) },
        { $set: { expiresAt: new Date(Date.now() - 1000) } },
      );
    await sendWebhook(webhookPayload(order.payment.reference, 329000)).expect(
      200,
      { success: true },
    );
    const event = await mongo.db
      ?.collection("payment_webhook_events")
      .findOne({ orderId: new Types.ObjectId(order.id as string) });
    expect(event?.outcomeCode).toBe("PAYMENT_AFTER_RESERVATION_EXPIRY");
  });

  it("enforces payment object ownership for guest credentials", async () => {
    const { order } = await onlineCheckout("FULL");
    const otherGuest = request.agent(app.getHttpServer());
    await otherGuest.get("/api/v1/cart").expect(200);
    await otherGuest
      .get(`/api/v1/payments/${order.orderCode}/status`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/payments/${order.orderCode}/status`)
      .expect(401);
  });
});
