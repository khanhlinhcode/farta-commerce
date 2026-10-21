import { afterEach, describe, expect, it, vi } from "vitest";

function catalogResponse() {
  return new Response(
    JSON.stringify({ items: [], page: 1, limit: 24, total: 0 }),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    },
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("catalog fetch policy", () => {
  it("keeps runtime catalog responses uncached in the Cloudflare staging mode", async () => {
    vi.stubEnv("CATALOG_CACHE_MODE", "no-store");
    const fetchMock = vi.fn(async () => catalogResponse());
    vi.stubGlobal("fetch", fetchMock);
    const { getProducts } = await import("./catalog");

    await getProducts({ page: 1, limit: 24, sort: "newest" });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/products?"),
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("uses authoritative build data for the static sitemap", async () => {
    vi.stubEnv("CATALOG_CACHE_MODE", "no-store");
    const fetchMock = vi.fn(async () => catalogResponse());
    vi.stubGlobal("fetch", fetchMock);
    const { getProducts } = await import("./catalog");

    await getProducts({ page: 1, limit: 100, sort: "newest" }, "build");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/products?"),
      expect.objectContaining({ cache: "force-cache" }),
    );
  });
});
