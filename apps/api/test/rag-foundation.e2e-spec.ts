import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getConnectionToken, getModelToken } from "@nestjs/mongoose";
import type { Connection, Model } from "mongoose";
import { createHmac, randomBytes } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { configureHttpApplication } from "../src/configure-http-app";
import { RagIngestionService } from "../src/rag/rag-ingestion.service";
import type { RagSourceDocument } from "../src/rag/rag.types";
import { RagRetrievalService } from "../src/rag/retrieval/rag-retrieval.service";
import { RagCitationResolverService } from "../src/rag/retrieval/rag-citation-resolver.service";
import {
  KnowledgeChunk,
  type KnowledgeChunkDocument,
} from "../src/rag/schemas/knowledge-chunk.schema";
import {
  KnowledgeDocument,
  type KnowledgeDocumentDocument,
} from "../src/rag/schemas/knowledge-document.schema";

const redisUrl = "redis://localhost:6379/14";
const toolsSecret = "t".repeat(32);

function signedToolHeaders(path: string, body: string) {
  const timestamp = String(Math.floor(Date.now() / 1_000));
  const nonce = randomBytes(32).toString("base64url");
  const audience = "farta-ai-tools";
  const signature = createHmac("sha256", toolsSecret)
    .update([timestamp, nonce, audience, "POST", path, body].join("."))
    .digest("base64url");
  return {
    "content-type": "application/json",
    "x-farta-ai-timestamp": timestamp,
    "x-farta-ai-nonce": nonce,
    "x-farta-ai-audience": audience,
    "x-farta-ai-signature": signature,
  };
}

function source(overrides: Partial<RagSourceDocument> = {}): RagSourceDocument {
  return {
    tenantId: "farta-rag-e2e",
    sourceType: "PRODUCT",
    sourceId: "farta-rag-e2e-tee",
    locale: "vi",
    title: "FARTA RAG E2E Tee",
    canonicalPath: "/product/farta-rag-e2e-tee",
    contentSections: [
      "FARTA RAG E2E Tee",
      "Áo cotton công khai dùng để xác minh vòng đời chỉ mục cục bộ.",
    ],
    sourceVersion: "2026-10-25T00:00:00.000Z",
    sourceUpdatedAt: new Date("2026-10-25T00:00:00.000Z"),
    publishedAt: new Date("2026-10-24T00:00:00.000Z"),
    metadata: {
      productSlug: "farta-rag-e2e-tee",
      categoryIds: [],
      tags: ["rag-e2e"],
    },
    ...overrides,
  };
}

describe("P2-B RAG MongoDB lifecycle", () => {
  let app: INestApplication;
  let mongo: Connection;
  let ingestion: RagIngestionService;
  let retrieval: RagRetrievalService;
  let citationResolver: RagCitationResolverService;
  let documents: Model<KnowledgeDocumentDocument>;
  let chunks: Model<KnowledgeChunkDocument>;

  beforeAll(async () => {
    Object.assign(process.env, {
      APP_ENV: "test",
      PORT: "4000",
      APP_ORIGIN: "http://localhost:3000",
      ADMIN_ORIGIN: "http://localhost:5173",
      API_ORIGIN: "http://localhost:4000",
      MONGODB_URI:
        "mongodb://localhost:27017/farta_rag_e2e?replicaSet=rs0&directConnection=true",
      REDIS_URL: redisUrl,
      AI_RAG_ENABLED: "true",
      AI_TOOLS_SHARED_SECRET: toolsSecret,
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
      CHECKOUT_LIMIT: "300",
      CHECKOUT_WINDOW_SECONDS: "300",
      ORDER_LOOKUP_LIMIT: "300",
      ORDER_LOOKUP_WINDOW_SECONDS: "300",
    });

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
    ingestion = app.get(RagIngestionService);
    retrieval = app.get(RagRetrievalService);
    citationResolver = app.get(RagCitationResolverService);
    documents = app.get<Model<KnowledgeDocumentDocument>>(
      getModelToken(KnowledgeDocument.name),
    );
    chunks = app.get<Model<KnowledgeChunkDocument>>(
      getModelToken(KnowledgeChunk.name),
    );
  }, 30_000);

  afterAll(async () => {
    await mongo?.db?.dropDatabase();
    await app?.close();
  });

  it("creates, replaces and tombstones a source atomically", async () => {
    const created = await ingestion.ingest(source());
    expect(created).toMatchObject({ outcome: "CREATED", chunks: 1 });
    expect(await documents.countDocuments({ status: "ACTIVE" })).toBe(1);
    expect(await chunks.countDocuments({ status: "ACTIVE" })).toBe(1);
    const retrieved = await retrieval.retrieve({
      tenantId: "farta-rag-e2e",
      query: "áo cotton công khai",
      locale: "vi",
      sourceTypes: ["PRODUCT"],
      limit: 1,
    });
    expect(retrieved.hits).toHaveLength(1);
    expect(retrieved.hits[0]?.citation).toMatchObject({
      sourceId: "farta-rag-e2e-tee",
      canonicalPath: "/product/farta-rag-e2e-tee",
      contentTrust: "UNTRUSTED_PUBLIC_CONTENT",
    });
    const citationId = retrieved.hits[0]?.citation.citationId;
    expect(citationId).toBeDefined();
    expect(
      await citationResolver.resolveActive("farta-rag-e2e", [citationId!]),
    ).toEqual([
      expect.objectContaining({
        citationId,
        sourceId: "farta-rag-e2e-tee",
      }),
    ]);

    const unchanged = await ingestion.ingest(source());
    expect(unchanged.outcome).toBe("UNCHANGED");
    expect(await documents.countDocuments()).toBe(1);
    expect(await chunks.countDocuments()).toBe(1);

    const replacement = source({
      contentSections: [
        "FARTA RAG E2E Tee",
        "Mô tả công khai đã được cập nhật và tạo một phiên bản mới.",
      ],
      sourceVersion: "2026-10-26T00:00:00.000Z",
      sourceUpdatedAt: new Date("2026-10-26T00:00:00.000Z"),
    });
    expect((await ingestion.ingest(replacement)).outcome).toBe("REPLACED");
    expect(await documents.countDocuments({ status: "ACTIVE" })).toBe(1);
    expect(await documents.countDocuments({ status: "SUPERSEDED" })).toBe(1);
    expect(await chunks.countDocuments({ status: "ACTIVE" })).toBe(1);
    expect(await chunks.countDocuments({ status: "SUPERSEDED" })).toBe(1);
    const replacementRetrieval = await retrieval.retrieve({
      tenantId: "farta-rag-e2e",
      query: "mô tả công khai đã được cập nhật",
      locale: "vi",
      sourceTypes: ["PRODUCT"],
      limit: 1,
    });
    const replacementCitationId =
      replacementRetrieval.hits[0]?.citation.citationId;
    expect(replacementCitationId).toBeDefined();
    expect(
      await citationResolver.resolveActive("farta-rag-e2e", [
        replacementCitationId!,
      ]),
    ).toHaveLength(1);

    const tombstoned = await ingestion.tombstone(replacement);
    expect(tombstoned).toMatchObject({
      documentsChanged: 1,
      chunksChanged: 1,
    });
    expect(await documents.countDocuments({ status: "ACTIVE" })).toBe(0);
    expect(await chunks.countDocuments({ status: "ACTIVE" })).toBe(0);
    expect(
      await citationResolver.resolveActive("farta-rag-e2e", [
        replacementCitationId!,
      ]),
    ).toEqual([]);
    expect((await ingestion.ingest(replacement)).outcome).toBe("STALE");
  });

  it("reconciles a complete source snapshot without touching another tenant", async () => {
    const active = source({
      sourceId: "farta-rag-reconcile",
      canonicalPath: "/product/farta-rag-reconcile",
      metadata: {
        productSlug: "farta-rag-reconcile",
        categoryIds: [],
        tags: [],
      },
    });
    const otherTenant = source({
      tenantId: "another-rag-tenant",
      sourceId: "preserved-source",
      canonicalPath: "/product/preserved-source",
      metadata: {
        productSlug: "preserved-source",
        categoryIds: [],
        tags: [],
      },
    });
    await ingestion.ingest(active);
    await ingestion.ingest(otherTenant);
    const otherChunk = await chunks
      .findOne({
        tenantId: otherTenant.tenantId,
        sourceId: otherTenant.sourceId,
        status: "ACTIVE",
      })
      .select({ _id: 0, chunkId: 1 })
      .lean()
      .exec();
    expect(otherChunk?.chunkId).toBeDefined();
    expect(
      await citationResolver.resolveActive(active.tenantId, [
        `citation:${otherChunk!.chunkId}`,
      ]),
    ).toEqual([]);

    const result = await ingestion.reconcileCompleteSourceSet({
      tenantId: active.tenantId,
      sourceType: active.sourceType,
      locale: active.locale,
      activeSourceIds: [],
    });
    expect(result).toMatchObject({ documentsChanged: 1, chunksChanged: 1 });
    expect(
      await documents.countDocuments({
        tenantId: otherTenant.tenantId,
        status: "ACTIVE",
      }),
    ).toBe(1);
    expect(
      await chunks.countDocuments({
        tenantId: otherTenant.tenantId,
        status: "ACTIVE",
      }),
    ).toBe(1);
  });

  it("rejects malformed and duplicate citation identifiers", async () => {
    const valid = `citation:ragchunk_${"a".repeat(64)}`;
    await expect(
      citationResolver.resolveActive("farta-rag-e2e", [valid, valid]),
    ).rejects.toThrow("RAG_CITATION_SET_INVALID");
    await expect(
      citationResolver.resolveActive("farta-rag-e2e", ["citation:invalid"]),
    ).rejects.toThrow("RAG_CITATION_ID_INVALID");
  });

  it("serves one signed knowledge request and rejects its replay", async () => {
    await ingestion.ingest(
      source({
        tenantId: "farta",
        sourceId: "eval-signed-knowledge-tool",
        canonicalPath: "/product/eval-signed-knowledge-tool",
        contentSections: [
          "Signed knowledge tool",
          "Áo cotton signed gateway dùng cho kiểm thử tích hợp cục bộ.",
        ],
        metadata: {
          productSlug: "eval-signed-knowledge-tool",
          categoryIds: [],
          tags: ["signed-gateway"],
        },
      }),
    );
    const path = "/api/v1/internal/ai/tools/search-knowledge";
    const body = JSON.stringify({
      query: "áo cotton signed gateway",
      locale: "vi",
      sourceTypes: ["PRODUCT"],
      limit: 1,
    });
    const headers = signedToolHeaders(path, body);

    const accepted = await request(app.getHttpServer())
      .post(path)
      .set(headers)
      .send(body)
      .expect(201);
    expect(accepted.body).toMatchObject({
      tool: "search_knowledge",
      citations: [
        {
          sourceId: "eval-signed-knowledge-tool",
          contentTrust: "UNTRUSTED_PUBLIC_CONTENT",
        },
      ],
    });

    await request(app.getHttpServer())
      .post(path)
      .set(headers)
      .send(body)
      .expect(401);
  });
});
