import { describe, expect, it } from "vitest";

import { assertLocalRagRebuildEnvironment } from "./rebuild-local-rag-index";

describe("local RAG rebuild gate", () => {
  it("accepts only development with the exact one-shot gate", () => {
    expect(() =>
      assertLocalRagRebuildEnvironment(
        "development",
        "REBUILD_LOCAL_RAG_FOUNDATION_V1",
        "mongodb://127.0.0.1:27017/farta?replicaSet=rs0&directConnection=true",
      ),
    ).not.toThrow();
  });

  it.each(["mongodb://localhost:27017/farta", "mongodb://[::1]:27017/farta"])(
    "accepts loopback MongoDB target %s",
    (uri) => {
      expect(() =>
        assertLocalRagRebuildEnvironment(
          "development",
          "REBUILD_LOCAL_RAG_FOUNDATION_V1",
          uri,
        ),
      ).not.toThrow();
    },
  );

  it.each(["test", "staging", "production", undefined])(
    "refuses environment %s",
    (environment) => {
      expect(() =>
        assertLocalRagRebuildEnvironment(
          environment,
          "REBUILD_LOCAL_RAG_FOUNDATION_V1",
          "mongodb://127.0.0.1:27017/farta",
        ),
      ).toThrow("APP_ENV=development");
    },
  );

  it("refuses a missing or incorrect gate", () => {
    expect(() =>
      assertLocalRagRebuildEnvironment(
        "development",
        undefined,
        "mongodb://127.0.0.1:27017/farta",
      ),
    ).toThrow("explicit local rebuild gate");
    expect(() =>
      assertLocalRagRebuildEnvironment(
        "development",
        "wrong-gate",
        "mongodb://127.0.0.1:27017/farta",
      ),
    ).toThrow("explicit local rebuild gate");
  });

  it.each([
    undefined,
    "not-a-uri",
    "mongodb+srv://cluster.example.test/farta",
    "mongodb://10.0.0.12:27017/farta",
    "mongodb://mongodb.internal:27017/farta",
  ])("refuses non-loopback MongoDB target %s", (uri) => {
    expect(() =>
      assertLocalRagRebuildEnvironment(
        "development",
        "REBUILD_LOCAL_RAG_FOUNDATION_V1",
        uri,
      ),
    ).toThrow(/loopback MongoDB/);
  });
});
