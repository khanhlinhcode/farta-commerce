import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getConnectionToken, getModelToken } from "@nestjs/mongoose";
import Redis from "ioredis";
import type { Connection, Model } from "mongoose";
import { Types } from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { User, type UserDocument } from "../src/auth/schemas/user.schema";
import { PasswordService } from "../src/auth/services/password.service";
import { configureHttpApplication } from "../src/configure-http-app";
import { ReservationsService } from "../src/reservations/reservations.service";

const adminOrigin = "http://localhost:5173";
const redisUrl = "redis://localhost:6379/12";

describe("Phase 4D order operations and workers", () => {
  let app: INestApplication;
  let mongo: Connection;
  let owner: ReturnType<typeof request.agent>;
  let restricted: ReturnType<typeof request.agent>;
  let ownerId: string;
  let ownerCsrf: string;
  let restrictedCsrf: string;
  let variantId: Types.ObjectId;
  let sequence = 0;

  beforeAll(async () => {
    Object.assign(process.env, {
      APP_ENV: "test",
      PORT: "4000",
      APP_ORIGIN: "http://localhost:3000",
      ADMIN_ORIGIN: adminOrigin,
      API_ORIGIN: "http://localhost:4000",
      MONGODB_URI:
        "mongodb://localhost:27017/farta_order_operations_e2e?replicaSet=rs0&directConnection=true",
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

    const users = app.get<Model<UserDocument>>(getModelToken(User.name));
    const passwords = app.get(PasswordService);
    const ownerUser = await users.create({
      normalizedEmail: "operations-owner@farta.test",
      passwordHash: await passwords.hash("a secure operations password"),
      displayName: "Operations Owner",
      roles: ["OWNER"],
      permissions: [],
      status: "ACTIVE",
      rolesVersion: 1,
      onboardingCompletedAt: new Date(),
    });
    ownerId = ownerUser.id;
    await users.create({
      normalizedEmail: "order-reader@farta.test",
      passwordHash: await passwords.hash("a secure reader password"),
      displayName: "Order Reader",
      roles: ["STAFF"],
      permissions: ["order.read"],
      status: "ACTIVE",
      rolesVersion: 1,
      onboardingCompletedAt: new Date(),
    });
    owner = request.agent(app.getHttpServer());
    const ownerPreAuth = await owner.get("/api/v1/auth/staff/csrf").expect(200);
    const ownerLogin = await owner
      .post("/api/v1/auth/staff/login")
      .set("origin", adminOrigin)
      .set("x-csrf-token", ownerPreAuth.body.csrfToken as string)
      .send({
        email: "operations-owner@farta.test",
        password: "a secure operations password",
      })
      .expect(201);
    ownerCsrf = ownerLogin.body.csrfToken as string;
    restricted = request.agent(app.getHttpServer());
    const restrictedPreAuth = await restricted
      .get("/api/v1/auth/staff/csrf")
      .expect(200);
    const restrictedLogin = await restricted
      .post("/api/v1/auth/staff/login")
      .set("origin", adminOrigin)
      .set("x-csrf-token", restrictedPreAuth.body.csrfToken as string)
      .send({
        email: "order-reader@farta.test",
        password: "a secure reader password",
      })
      .expect(201);
    restrictedCsrf = restrictedLogin.body.csrfToken as string;

    variantId = new Types.ObjectId();
    await mongo.db?.collection("inventory").insertOne({
      variantId,
      onHand: 20,
      reserved: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }, 30_000);

  afterAll(async () => {
    await mongo?.db?.dropDatabase();
    await app?.close();
  });

  async function seedOrder(
    input: {
      status?: "CREATED" | "PAYMENT_CONFLICT";
      paymentStatus?: "UNPAID" | "CONFLICT";
      provider?: "COD" | "SEPAY";
      method?: "COD" | "FULL";
      receivedAmount?: number;
    } = {},
  ) {
    sequence += 1;
    const suffix = `OPS${String(sequence).padStart(7, "A")}`;
    const orderId = new Types.ObjectId();
    const reservationId = new Types.ObjectId();
    const now = new Date();
    const status = input.status ?? "CREATED";
    const paymentStatus = input.paymentStatus ?? "UNPAID";
    const provider = input.provider ?? "COD";
    const method = input.method ?? "COD";
    const orderCode = `FAR-20261008-${suffix}`;
    await mongo.db
      ?.collection("inventory")
      .updateOne({ variantId }, { $inc: { reserved: 1 } });
    await mongo.db?.collection("orders").insertOne({
      _id: orderId,
      orderCode,
      customerId: null,
      guestOwnerDigest: "guest-digest",
      lookupPhoneDigest: "f".repeat(64),
      cartId: new Types.ObjectId(),
      status,
      paymentStatus,
      paymentMethod: method,
      items: [
        {
          productId: new Types.ObjectId(),
          variantId,
          productName: "FARTA Operations Tee",
          sku: `FAR-OPS-${sequence}`,
          color: "Black",
          size: "M",
          unitPrice: 299000,
          quantity: 1,
          lineSubtotal: 299000,
          image: null,
        },
      ],
      shipping: {
        recipientName: "Linh To",
        phone: "+84912345678",
        addressLine: "12 Nguyen Hue",
        provinceCity: "Ho Chi Minh City",
        district: "District 1",
        ward: "Ben Nghe",
        method: "STANDARD",
        notes: null,
      },
      itemsSubtotal: 299000,
      shippingFee: 30000,
      total: 329000,
      currency: "VND",
      statusHistory: [
        {
          status,
          at: now,
          actorType: "SYSTEM",
          actorId: null,
          requestId: `seed-${sequence}`,
        },
      ],
      idempotencyRecordId: new Types.ObjectId(),
      createdAt: now,
      updatedAt: now,
    });
    await mongo.db?.collection("payments").insertOne({
      orderId,
      provider,
      method,
      expectedAmount: 329000,
      orderTotal: 329000,
      receivedAmount: input.receivedAmount ?? 0,
      currency: "VND",
      status: paymentStatus,
      idempotencyKeyHash: "a".repeat(64),
      providerTransactionId: provider === "SEPAY" ? `TX-${sequence}` : null,
      providerReference: provider === "SEPAY" ? `FAROPS${sequence}` : null,
      providerTransactionIds: provider === "SEPAY" ? [`TX-${sequence}`] : [],
      providerPayloadSafeSummary: null,
      codAmount: method === "COD" ? 329000 : 0,
      codCollectedAt: null,
      codCollectedBy: null,
      expiresAt: null,
      reconciliationReference: null,
      reconciliationReason: null,
      reconciledBy: null,
      reconciledAt: null,
      createdAt: now,
      updatedAt: now,
    });
    await mongo.db?.collection("inventory_reservations").insertOne({
      _id: reservationId,
      variantId,
      quantity: 1,
      cartId: new Types.ObjectId(),
      customerId: null,
      guestOwnerDigest: "guest-digest",
      status: "CONFIRMED",
      expiresAt: new Date(Date.now() + 900_000),
      confirmedAt: now,
      releasedAt: null,
      referenceType: "ORDER",
      referenceId: orderId,
      idempotencyRecordId: new Types.ObjectId(),
      createdAt: now,
      updatedAt: now,
    });
    return { orderCode, orderId, reservationId };
  }

  it("lists bounded orders and rejects query injection", async () => {
    const seeded = await seedOrder();
    const list = await owner
      .get(`/api/v1/admin/orders?q=${seeded.orderCode}&limit=10`)
      .expect(200);
    expect(list.body).toMatchObject({ total: 1, page: 1, limit: 10 });
    expect(list.body.items[0].orderCode).toBe(seeded.orderCode);
    await owner.get("/api/v1/admin/orders?q[$ne]=x").expect(400);
    await owner.get("/api/v1/admin/orders?limit=1000000").expect(400);
  });

  it("enforces staff permission, CSRF and mass-assignment boundaries", async () => {
    const seeded = await seedOrder();
    await restricted.get("/api/v1/admin/orders").expect(200);
    await restricted
      .patch(`/api/v1/admin/orders/${seeded.orderCode}/status`)
      .set("origin", adminOrigin)
      .set("x-csrf-token", restrictedCsrf)
      .send({ status: "CONFIRMED", reason: "Reader must not mutate" })
      .expect(403);
    await owner
      .patch(`/api/v1/admin/orders/${seeded.orderCode}/status`)
      .set("origin", adminOrigin)
      .send({ status: "CONFIRMED", reason: "Missing CSRF" })
      .expect(403);
    await owner
      .patch(`/api/v1/admin/orders/${seeded.orderCode}/status`)
      .set("origin", adminOrigin)
      .set("x-csrf-token", ownerCsrf)
      .send({
        status: "CONFIRMED",
        paymentStatus: "FULLY_PAID",
        reason: "Mass assignment attempt",
      })
      .expect(400);
    await request(app.getHttpServer())
      .get(`/api/v1/admin/orders/${seeded.orderCode}`)
      .expect(401);
  });

  it("applies only valid fulfillment transitions and commits inventory sale once", async () => {
    const seeded = await seedOrder();
    for (const status of ["CONFIRMED", "PACKING", "SHIPPING"] as const) {
      await owner
        .patch(`/api/v1/admin/orders/${seeded.orderCode}/status`)
        .set("origin", adminOrigin)
        .set("x-csrf-token", ownerCsrf)
        .send({ status, reason: `Move order to ${status}` })
        .expect(200);
    }
    await owner
      .patch(`/api/v1/admin/orders/${seeded.orderCode}/status`)
      .set("origin", adminOrigin)
      .set("x-csrf-token", ownerCsrf)
      .send({ status: "CREATED", reason: "Invalid backward transition" })
      .expect(409);
    const inventory = await mongo.db
      ?.collection("inventory")
      .findOne({ variantId });
    expect(inventory).toMatchObject({ onHand: 19, reserved: 2 });
    expect(
      await mongo.db?.collection("inventory_transactions").countDocuments({
        referenceId: seeded.orderId.toString(),
        type: "SALE",
      }),
    ).toBe(1);
    const detail = await owner
      .get(`/api/v1/admin/orders/${seeded.orderCode}`)
      .expect(200);
    expect(detail.body.status).toBe("SHIPPING");
    expect(detail.body.audit).toHaveLength(3);
    expect(
      await mongo.db?.collection("notification_events").countDocuments({
        aggregateId: seeded.orderId,
        type: { $in: ["ORDER_CONFIRMED", "ORDER_SHIPPED"] },
      }),
    ).toBe(2);
    await owner
      .patch(`/api/v1/admin/orders/${seeded.orderCode}/status`)
      .set("origin", adminOrigin)
      .set("x-csrf-token", ownerCsrf)
      .send({ status: "DELIVERED", reason: "Carrier confirmed delivery" })
      .expect(200);
    await owner
      .post(`/api/v1/admin/orders/${seeded.orderCode}/cod-collected`)
      .set("origin", adminOrigin)
      .set("x-csrf-token", ownerCsrf)
      .send({ reason: "Courier remittance reconciled" })
      .expect(201);
    await owner
      .post(`/api/v1/admin/orders/${seeded.orderCode}/cod-collected`)
      .set("origin", adminOrigin)
      .set("x-csrf-token", ownerCsrf)
      .send({ reason: "Duplicate COD collection" })
      .expect(409);
    await owner
      .patch(`/api/v1/admin/orders/${seeded.orderCode}/status`)
      .set("origin", adminOrigin)
      .set("x-csrf-token", ownerCsrf)
      .send({ status: "COMPLETED", reason: "Order and COD are complete" })
      .expect(200);
    const payment = await mongo.db
      ?.collection("payments")
      .findOne({ orderId: seeded.orderId });
    expect(payment).toMatchObject({
      status: "FULLY_PAID",
      receivedAmount: 329000,
      codCollectedBy: new Types.ObjectId(ownerId),
    });
  });

  it("cancels atomically and releases inventory once", async () => {
    const seeded = await seedOrder();
    await owner
      .post(`/api/v1/admin/orders/${seeded.orderCode}/cancel`)
      .set("origin", adminOrigin)
      .set("x-csrf-token", ownerCsrf)
      .send({ reason: "Customer requested cancellation" })
      .expect(201);
    await owner
      .post(`/api/v1/admin/orders/${seeded.orderCode}/cancel`)
      .set("origin", adminOrigin)
      .set("x-csrf-token", ownerCsrf)
      .send({ reason: "Duplicate cancellation" })
      .expect(409);
    const reservation = await mongo.db
      ?.collection("inventory_reservations")
      .findOne({ _id: seeded.reservationId });
    expect(reservation?.status).toBe("CANCELLED");
    expect(
      await mongo.db?.collection("inventory_transactions").countDocuments({
        referenceId: seeded.orderId.toString(),
        type: "RELEASE",
      }),
    ).toBe(1);
  });

  it("requires an explicit, audited refund reconciliation before cancelling paid conflicts", async () => {
    const seeded = await seedOrder({
      status: "PAYMENT_CONFLICT",
      paymentStatus: "CONFLICT",
      provider: "SEPAY",
      method: "FULL",
      receivedAmount: 100000,
    });
    await owner
      .post(`/api/v1/admin/orders/${seeded.orderCode}/cancel`)
      .set("origin", adminOrigin)
      .set("x-csrf-token", ownerCsrf)
      .send({ reason: "Must reconcile money first" })
      .expect(409);
    await owner
      .post(`/api/v1/admin/orders/${seeded.orderCode}/payment-reconciliation`)
      .set("origin", adminOrigin)
      .set("x-csrf-token", ownerCsrf)
      .send({ action: "START_REFUND", reason: "Manual provider refund opened" })
      .expect(201);
    await owner
      .post(`/api/v1/admin/orders/${seeded.orderCode}/payment-reconciliation`)
      .set("origin", adminOrigin)
      .set("x-csrf-token", ownerCsrf)
      .send({ action: "CONFIRM_REFUNDED", reason: "Missing proof" })
      .expect(400);
    await owner
      .post(`/api/v1/admin/orders/${seeded.orderCode}/payment-reconciliation`)
      .set("origin", adminOrigin)
      .set("x-csrf-token", ownerCsrf)
      .send({
        action: "CONFIRM_REFUNDED",
        reason: "External refund verified",
        externalReference: "REFUND-TEST-001",
      })
      .expect(201);
    await owner
      .post(`/api/v1/admin/orders/${seeded.orderCode}/cancel`)
      .set("origin", adminOrigin)
      .set("x-csrf-token", ownerCsrf)
      .send({ reason: "Refund completed; release stock" })
      .expect(201);
    const payment = await mongo.db
      ?.collection("payments")
      .findOne({ orderId: seeded.orderId });
    expect(payment).toMatchObject({
      status: "REFUNDED",
      reconciliationReference: "REFUND-TEST-001",
      reconciledBy: new Types.ObjectId(ownerId),
    });
    expect(
      await mongo.db?.collection("audit_logs").countDocuments({
        resourceId: seeded.orderId.toString(),
        action: { $in: ["payment.refund_pending", "payment.refunded"] },
      }),
    ).toBe(2);
  });

  it("lets concurrent reservation workers release an expired reservation once", async () => {
    const reservationId = new Types.ObjectId();
    await mongo.db
      ?.collection("inventory")
      .updateOne({ variantId }, { $inc: { reserved: 1 } });
    await mongo.db?.collection("inventory_reservations").insertOne({
      _id: reservationId,
      variantId,
      quantity: 1,
      cartId: new Types.ObjectId(),
      customerId: null,
      guestOwnerDigest: "expired-worker-test",
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
    const released = await Promise.all([
      reservations.expireDue(10, "worker-a"),
      reservations.expireDue(10, "worker-b"),
    ]);
    expect(released.reduce((sum, count) => sum + count, 0)).toBe(1);
    expect(
      await mongo.db?.collection("inventory_transactions").countDocuments({
        referenceId: reservationId.toString(),
        type: "RELEASE",
      }),
    ).toBe(1);
  });
});
