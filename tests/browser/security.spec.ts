import { expect, test } from "@playwright/test";

import {
  addSeedProductToCart,
  cancelBrowserOrderAsStaff,
  fillCheckout,
  registerCustomer,
  seed,
} from "./support";

test("customer realm cannot access Admin and authenticated CSRF remains enforced", async ({
  page,
}) => {
  await registerCustomer(page);
  const result = await page.evaluate(async (productSlug) => {
    const productResponse = await fetch(`/api/v1/products/${productSlug}`);
    const product = (await productResponse.json()) as {
      variants: Array<{ id: string }>;
    };
    const adminResponse = await fetch("/api/v1/admin/orders", {
      credentials: "include",
    });
    const cartResponse = await fetch("/api/v1/cart/items", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ variantId: product.variants[0]?.id, quantity: 1 }),
    });
    return {
      adminStatus: adminResponse.status,
      cartStatus: cartResponse.status,
      browserCookie: document.cookie,
      localKeys: Object.keys(localStorage),
      sessionKeys: Object.keys(sessionStorage),
      cartError: await cartResponse.text(),
    };
  }, seed.productSlug);

  expect([401, 403]).toContain(result.adminStatus);
  expect(result.cartStatus).toBe(403);
  expect(result.browserCookie).not.toMatch(/access|refresh/i);
  expect([...result.localKeys, ...result.sessionKeys]).not.toContain(
    "accessToken",
  );
  expect(result.cartError).not.toMatch(/\b(stack|node_modules|MongoServer)\b/i);
});

test("customer B cannot read customer A order", async ({ page }) => {
  await addSeedProductToCart(page);
  await registerCustomer(page);
  await fillCheckout(page, "0945678901");
  await page.getByRole("button", { name: /Đặt hàng COD/ }).click();
  await expect(page).toHaveURL(/\/order-confirmation\/FAR-/);
  const code = decodeURIComponent(
    new URL(page.url()).pathname.split("/").at(-1) ?? "",
  );

  await page.goto("/account/security");
  await page.getByRole("button", { name: "Đăng xuất thiết bị này" }).click();
  await expect(page).toHaveURL(/\/login/);
  await registerCustomer(page);
  const response = await page.request.get(`/api/v1/orders/${code}`);
  expect([403, 404]).toContain(response.status());
  expect(await response.text()).not.toMatch(
    /\b(stack|node_modules|MongoServer)\b/i,
  );
  await cancelBrowserOrderAsStaff(code);
});

test("checkout rejects client-supplied authoritative totals", async ({
  page,
}) => {
  await addSeedProductToCart(page);
  await page.goto("/checkout");
  const result = await page.evaluate(async () => {
    const previewResponse = await fetch("/api/v1/checkout/preview", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const preview = (await previewResponse.json()) as { quoteToken: string };
    const checkoutResponse = await fetch("/api/v1/checkout", {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        "idempotency-key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        recipientName: "Khách E2E Tamper",
        phone: "0956789012",
        addressLine: "12 Nguyễn Huệ",
        provinceCity: "TP. Hồ Chí Minh",
        district: "Quận 1",
        ward: "Bến Nghé",
        shippingMethod: "STANDARD",
        paymentMethod: "COD",
        quoteToken: preview.quoteToken,
        total: 1,
        unitPrice: 1,
      }),
    });
    return {
      status: checkoutResponse.status,
      body: await checkoutResponse.text(),
    };
  });

  expect(result.status).toBe(400);
  expect(result.body).not.toMatch(/\b(stack|node_modules|MongoServer)\b/i);
});
