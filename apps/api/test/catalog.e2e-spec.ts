import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getConnectionToken, getModelToken } from "@nestjs/mongoose";
import Redis from "ioredis";
import type { Connection, Model } from "mongoose";
import { Types } from "mongoose";
import { createHash } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { User, type UserDocument } from "../src/auth/schemas/user.schema";
import { PasswordService } from "../src/auth/services/password.service";
import { configureHttpApplication } from "../src/configure-http-app";
import { InventoryService } from "../src/inventory/inventory.service";

const adminOrigin = "http://localhost:5173";
const redisUrl = "redis://localhost:6379/14";

describe("Phase 2 catalog and inventory", () => {
  let app: INestApplication;
  let mongo: Connection;
  let ownerId: string;
  let categoryId: string;
  let productId: string;
  let variantId: string;
  let coverMediaId: string;
  let csrfToken: string;
  let admin: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    Object.assign(process.env, {
      APP_ENV: "test",
      PORT: "4000",
      APP_ORIGIN: "http://localhost:3000",
      ADMIN_ORIGIN: adminOrigin,
      API_ORIGIN: "http://localhost:4000",
      MONGODB_URI:
        "mongodb://localhost:27017/farta_catalog_e2e?replicaSet=rs0&directConnection=true",
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
      CHECKOUT_RESERVATION_TTL_SECONDS: "900",
      SHIPPING_FLAT_FEE_VND: "30000",
      FREE_SHIPPING_THRESHOLD_VND: "1000000",
      ORDER_LOOKUP_SECRET: "e".repeat(32),
      CHECKOUT_LIMIT: "300",
      CHECKOUT_WINDOW_SECONDS: "300",
      ORDER_LOOKUP_LIMIT: "300",
      ORDER_LOOKUP_WINDOW_SECONDS: "300",
      CLOUDINARY_CLOUD_NAME: "farta-test",
      CLOUDINARY_API_KEY: "test-api-key",
      CLOUDINARY_API_SECRET: "test-cloudinary-secret",
      CLOUDINARY_UPLOAD_MAX_BYTES: "10000000",
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

    const users = app.get<Model<UserDocument>>(getModelToken(User.name));
    const passwords = app.get(PasswordService);
    const owner = await users.create({
      normalizedEmail: "owner@farta.test",
      passwordHash: await passwords.hash("a secure owner password"),
      displayName: "FARTA Owner",
      roles: ["OWNER"],
      permissions: [],
      status: "ACTIVE",
      rolesVersion: 1,
      onboardingCompletedAt: new Date(),
    });
    ownerId = owner.id;
    await users.create({
      normalizedEmail: "restricted@farta.test",
      passwordHash: await passwords.hash("a restricted staff password"),
      displayName: "Restricted Staff",
      roles: ["STAFF"],
      permissions: ["product.read"],
      status: "ACTIVE",
      rolesVersion: 1,
      onboardingCompletedAt: new Date(),
    });

    admin = request.agent(app.getHttpServer());
    const csrf = await admin.get("/api/v1/auth/staff/csrf").expect(200);
    const login = await admin
      .post("/api/v1/auth/staff/login")
      .set("origin", adminOrigin)
      .set("x-csrf-token", csrf.body.csrfToken as string)
      .send({ email: "owner@farta.test", password: "a secure owner password" })
      .expect(201);
    csrfToken = login.body.csrfToken as string;
  }, 30_000);

  afterAll(async () => {
    await mongo?.db?.dropDatabase();
    await app?.close();
  });

  it("creates categories with normalized unique slugs and rejects mass assignment", async () => {
    await admin
      .post("/api/v1/admin/categories")
      .set("origin", adminOrigin)
      .set("x-csrf-token", csrfToken)
      .send({ name: "Blocked", createdBy: new Types.ObjectId().toString() })
      .expect(400);

    const created = await admin
      .post("/api/v1/admin/categories")
      .set("origin", adminOrigin)
      .set("x-csrf-token", csrfToken)
      .send({ name: "Áo Thun Nữ", status: "ACTIVE", sortOrder: 10 })
      .expect(201);
    categoryId = created.body.id as string;
    expect(created.body.slug).toBe("ao-thun-nu");

    const attempts = await Promise.all([
      admin
        .post("/api/v1/admin/categories")
        .set("origin", adminOrigin)
        .set("x-csrf-token", csrfToken)
        .send({ name: "Duplicate A", slug: "duplicate" }),
      admin
        .post("/api/v1/admin/categories")
        .set("origin", adminOrigin)
        .set("x-csrf-token", csrfToken)
        .send({ name: "Duplicate B", slug: "duplicate" }),
    ]);
    expect(attempts.map(({ status }) => status).sort()).toEqual([201, 409]);
  });

  it("enforces catalog permissions for restricted staff", async () => {
    const restricted = request.agent(app.getHttpServer());
    const csrf = await restricted.get("/api/v1/auth/staff/csrf").expect(200);
    await restricted
      .post("/api/v1/auth/staff/login")
      .set("origin", adminOrigin)
      .set("x-csrf-token", csrf.body.csrfToken as string)
      .send({
        email: "restricted@farta.test",
        password: "a restricted staff password",
      })
      .expect(201);
    await restricted.get("/api/v1/admin/products").expect(200);
    await restricted.get("/api/v1/admin/categories").expect(403);
    await restricted.get("/api/v1/admin/audit-logs").expect(403);
  });

  it("prevents self-parenting and NoSQL-shaped public filters", async () => {
    await admin
      .patch(`/api/v1/admin/categories/${categoryId}`)
      .set("origin", adminOrigin)
      .set("x-csrf-token", csrfToken)
      .send({ parentCategoryId: categoryId })
      .expect(400);
    await request(app.getHttpServer())
      .get("/api/v1/products?q[$ne]=x")
      .expect(400);
  });

  it("creates a draft product and an atomic variant plus inventory record", async () => {
    const mediaObjectId = new Types.ObjectId();
    coverMediaId = mediaObjectId.toString();
    await mongo.db?.collection("media_assets").insertOne({
      _id: mediaObjectId,
      provider: "CLOUDINARY",
      publicId: "farta/catalog/product-cover",
      secureUrl:
        "https://res.cloudinary.com/farta-test/image/upload/v1/farta/catalog/product-cover.jpg",
      resourceType: "image",
      format: "jpg",
      width: 1200,
      height: 1500,
      bytes: 500000,
      originalFilename: "product-cover.jpg",
      altText: "FARTA Essential Tee",
      createdBy: new Types.ObjectId(ownerId),
      archivedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const product = await admin
      .post("/api/v1/admin/products")
      .set("origin", adminOrigin)
      .set("x-csrf-token", csrfToken)
      .send({
        name: "FARTA Essential Tee",
        categoryIds: [categoryId],
        coverMediaId,
        tags: ["essential", "tee"],
      })
      .expect(201);
    productId = product.body.id as string;

    const variant = await admin
      .post(`/api/v1/admin/products/${productId}/variants`)
      .set("origin", adminOrigin)
      .set("x-csrf-token", csrfToken)
      .send({
        sku: "far-tee-blk-m",
        color: "Black",
        colorCode: "#111111",
        size: "M",
        price: 299000,
        compareAtPrice: 399000,
        lowStockThreshold: 2,
      })
      .expect(201);
    variantId = variant.body.id as string;
    expect(variant.body).toMatchObject({
      sku: "FAR-TEE-BLK-M",
      price: 299000,
      currency: "VND",
    });

    const inventory = await admin
      .get(`/api/v1/admin/inventory/${variantId}`)
      .expect(200);
    expect(inventory.body).toMatchObject({
      onHand: 0,
      reserved: 0,
      available: 0,
    });
  });

  it("makes inventory adjustments idempotent", async () => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await admin
        .patch(`/api/v1/admin/inventory/${variantId}/adjustments`)
        .set("origin", adminOrigin)
        .set("x-csrf-token", csrfToken)
        .set("idempotency-key", "catalog-stock-import-001")
        .send({ quantityDelta: 1, reason: "Initial controlled import" })
        .expect(200);
      expect(response.body.onHand).toBe(1);
    }
  });

  it("allows exactly one of 100 concurrent reservations for the last unit", async () => {
    const inventory = app.get(InventoryService);
    const results = await Promise.allSettled(
      Array.from({ length: 100 }, (_, index) =>
        inventory.reserve(
          variantId,
          1,
          "Phase 2 concurrency proof",
          `reservation-concurrency-${index}`,
          { userId: ownerId, requestId: `concurrency-${index}` },
        ),
      ),
    );
    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(
      1,
    );
    expect(results.filter(({ status }) => status === "rejected")).toHaveLength(
      99,
    );
    await expect(inventory.get(variantId)).resolves.toMatchObject({
      onHand: 1,
      reserved: 1,
      available: 0,
    });
  }, 30_000);

  it("publishes only after invariants pass and exposes a safe public read model", async () => {
    await admin
      .patch(`/api/v1/admin/products/${productId}`)
      .set("origin", adminOrigin)
      .set("x-csrf-token", csrfToken)
      .send({ status: "ACTIVE" })
      .expect(200);

    const publicProduct = await request(app.getHttpServer())
      .get("/api/v1/products/farta-essential-tee")
      .expect(200);
    expect(publicProduct.body).toMatchObject({
      slug: "farta-essential-tee",
      price: { currency: "VND", min: 299000, max: 299000 },
      coverMedia: { id: coverMediaId },
    });
    expect(publicProduct.body.variants[0].availability).toBe("OUT_OF_STOCK");
    expect(publicProduct.body).not.toHaveProperty("createdBy");
    expect(publicProduct.body.variants[0]).not.toHaveProperty("onHand");
    expect(JSON.stringify(publicProduct.body)).not.toContain(ownerId);
  });

  it("verifies Cloudinary responses and protects referenced banner media", async () => {
    const authorization = await admin
      .post("/api/v1/admin/media/upload-authorizations")
      .set("origin", adminOrigin)
      .set("x-csrf-token", csrfToken)
      .expect(201);
    expect(authorization.body).not.toHaveProperty("apiSecret");
    expect(authorization.body.signature).toMatch(/^[a-f0-9]{64}$/);

    const version = 1_750_000_000;
    const signature = createHash("sha1")
      .update(
        `public_id=${authorization.body.publicId as string}&version=${version}test-cloudinary-secret`,
      )
      .digest("hex");
    const payload = {
      publicId: authorization.body.publicId,
      secureUrl: `https://res.cloudinary.com/farta-test/image/upload/v${version}/${authorization.body.publicId as string}.jpg`,
      resourceType: "image",
      format: "jpg",
      width: 1600,
      height: 2000,
      bytes: 800000,
      version,
      signature,
      originalFilename: "../campaign.jpg",
      altText: "FARTA campaign",
    };

    await admin
      .post("/api/v1/admin/media/finalize")
      .set("origin", adminOrigin)
      .set("x-csrf-token", csrfToken)
      .send({ ...payload, signature: "0".repeat(40) })
      .expect(400);
    const media = await admin
      .post("/api/v1/admin/media/finalize")
      .set("origin", adminOrigin)
      .set("x-csrf-token", csrfToken)
      .send(payload)
      .expect(201);
    expect(media.body.originalFilename).toBe("campaign.jpg");

    await admin
      .post("/api/v1/admin/banners")
      .set("origin", adminOrigin)
      .set("x-csrf-token", csrfToken)
      .send({
        title: "Unsafe campaign",
        desktopMediaId: media.body.id,
        position: "home-hero",
        ctaTarget: "https://evil.example",
      })
      .expect(400);

    const banner = await admin
      .post("/api/v1/admin/banners")
      .set("origin", adminOrigin)
      .set("x-csrf-token", csrfToken)
      .send({
        title: "FARTA Modern Essentials",
        subtitle: "Một nhịp điệu mới cho tủ đồ hằng ngày.",
        desktopMediaId: media.body.id,
        position: "home-hero",
        priority: 100,
        ctaLabel: "Khám phá",
        ctaTarget: "/shop",
        status: "ACTIVE",
      })
      .expect(201);

    const publicBanners = await request(app.getHttpServer())
      .get("/api/v1/banners?position=home-hero")
      .expect(200);
    expect(publicBanners.body.items[0]).toMatchObject({
      id: banner.body.id,
      ctaTarget: "/shop",
      desktopMedia: { id: media.body.id },
    });
    expect(publicBanners.body.items[0]).not.toHaveProperty("createdBy");

    await admin
      .delete(`/api/v1/admin/media/${media.body.id as string}`)
      .set("origin", adminOrigin)
      .set("x-csrf-token", csrfToken)
      .expect(409);
  });

  it("exposes append-only audit evidence only to authorized staff", async () => {
    const audit = await admin
      .get("/api/v1/admin/audit-logs?resourceType=Inventory")
      .expect(200);
    expect(audit.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "inventory.adjust" }),
      ]),
    );
    expect(JSON.stringify(audit.body)).not.toContain("test-cloudinary-secret");
  });
});
