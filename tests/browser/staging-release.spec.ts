import { expect, test } from "@playwright/test";

import { addSeedProductToCart, seed, urls } from "./support";

const isStaging = process.env.E2E_TARGET === "staging";

test.describe("deployed staging release evidence", () => {
  test.skip(!isStaging, "These checks target deployed HTTPS staging only.");

  test("runtime, public DTOs and Cloudinary media remain bounded", async ({
    page,
    request,
  }) => {
    for (const endpoint of ["health/live", "health/ready"]) {
      const response = await request.get(`${urls.api}/api/v1/${endpoint}`);
      expect(response.status()).toBe(200);
      expect(await response.json()).toMatchObject({ status: "ok" });
    }

    const productsResponse = await request.get(
      `${urls.api}/api/v1/products?limit=20`,
    );
    expect(productsResponse.status()).toBe(200);
    const products = (await productsResponse.json()) as {
      items: Array<{
        slug: string;
        description: string | null;
        coverMedia: { secureUrl: string } | null;
        media: Array<{ secureUrl: string }>;
        variants: Array<{
          availability: string;
          media: Array<{ secureUrl: string }>;
        }>;
      }>;
      total: number;
    };
    expect(products.total).toBeGreaterThanOrEqual(2);
    expect(products.items.map(({ slug }) => slug)).toContain(seed.productSlug);

    const serialized = JSON.stringify(products);
    for (const forbiddenField of [
      "createdBy",
      "updatedBy",
      "onHand",
      "reserved",
      "inventoryTransaction",
      "auditLog",
      "apiSecret",
    ]) {
      expect(serialized).not.toContain(`"${forbiddenField}":`);
    }
    const availability = products.items.flatMap(({ variants }) =>
      variants.map((variant) => variant.availability),
    );
    expect(availability.length).toBeGreaterThan(0);
    expect(
      availability.every((value) =>
        ["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"].includes(value),
      ),
    ).toBe(true);

    const mediaUrls = new Set(
      products.items.flatMap((product) => [
        ...(product.coverMedia ? [product.coverMedia.secureUrl] : []),
        ...product.media.map(({ secureUrl }) => secureUrl),
        ...product.variants.flatMap((variant) =>
          variant.media.map(({ secureUrl }) => secureUrl),
        ),
      ]),
    );
    expect(mediaUrls.size).toBeGreaterThan(0);
    for (const mediaUrl of mediaUrls) {
      expect(new URL(mediaUrl).hostname).toBe("res.cloudinary.com");
      const image = await request.get(mediaUrl);
      expect(image.status()).toBe(200);
      expect(image.headers()["content-type"]).toMatch(/^image\//);
    }

    await page.goto(`/product/${seed.productSlug}`);
    const product = products.items.find(
      ({ slug }) => slug === seed.productSlug,
    );
    if (product?.description) {
      const description = page.getByText(product.description, { exact: true });
      await expect(description).toBeVisible();
      expect(
        await description.evaluate((element) => element.children.length),
      ).toBe(0);
    }
  });

  test("staging headers, robots and CORS remain restrictive", async ({
    request,
  }) => {
    const targets = [
      `${urls.api}/api/v1/health/live`,
      urls.storefront,
      urls.admin,
    ];
    for (const target of targets) {
      const response = await request.get(target);
      expect(response.status()).toBe(200);
      const headers = response.headers();
      expect(headers["strict-transport-security"]).toBeTruthy();
      expect(headers["content-security-policy"]).toBeTruthy();
      expect(headers["x-content-type-options"]).toBe("nosniff");
      expect(headers["referrer-policy"]).toBeTruthy();
      expect(
        headers["x-frame-options"] ?? headers["content-security-policy"],
      ).toBeTruthy();
    }

    const robots = await request.get(`${urls.storefront}/robots.txt`);
    expect(robots.status()).toBe(200);
    expect(await robots.text()).toMatch(/Disallow:\s*\//);

    const untrustedOrigin = await request.get(`${urls.api}/api/v1/products`, {
      headers: { origin: "https://attacker.example" },
    });
    expect(
      untrustedOrigin.headers()["access-control-allow-origin"],
    ).toBeFalsy();
  });

  test("guest Cart credential is secure, isolated and not localStorage state", async ({
    page,
    browser,
  }) => {
    await addSeedProductToCart(page);
    const cookies = await page.context().cookies();
    const guestCredential = cookies.find(({ name }) =>
      name.endsWith("farta_guest_cart"),
    );
    expect(guestCredential).toBeTruthy();
    expect(guestCredential?.secure).toBe(true);
    expect(guestCredential?.httpOnly).toBe(true);
    expect(guestCredential?.sameSite).toBe("Lax");
    expect(
      await page.evaluate(() => ({
        local: Object.keys(localStorage),
        session: Object.keys(sessionStorage),
      })),
    ).toEqual({ local: [], session: [] });

    await page.reload();
    await expect(
      page.getByRole("link", { name: /Giỏ hàng, 1 sản phẩm/ }),
    ).toBeVisible();

    const isolatedContext = await browser.newContext();
    try {
      const isolatedPage = await isolatedContext.newPage();
      await isolatedPage.goto(`${urls.storefront}/cart`);
      await expect(
        isolatedPage.getByRole("heading", { name: /Giỏ hàng đang đợi/ }),
      ).toBeVisible();
    } finally {
      await isolatedContext.close();
    }

    await page.goto("/cart");
    await page.getByRole("button", { name: "Xóa", exact: true }).click();
  });

  test("guest order lookup fails closed without enumeration detail", async ({
    request,
  }) => {
    const response = await request.post(`${urls.api}/api/v1/orders/lookup`, {
      headers: { origin: urls.storefront },
      data: {
        orderCode: "FAR-20990101-NOTREAL001",
        phone: "0900000000",
      },
    });
    expect([400, 404]).toContain(response.status());
    const body = await response.text();
    expect(body).not.toMatch(
      /\b(stack|node_modules|MongoServer|lookupPhoneDigest|customerId|paymentProviderPayload)\b/i,
    );
  });
});
