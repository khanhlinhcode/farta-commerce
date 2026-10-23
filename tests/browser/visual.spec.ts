import { expect, test, type Page } from "@playwright/test";

import {
  addSeedProductToCart,
  cancelBrowserOrder,
  createOrderInNewContext,
  fillCheckout,
  loginStaff,
  seed,
  urls,
} from "./support";

test.use({ trace: "off" });
const providerMode = process.env.E2E_AI_PROVIDER_MODE ?? "off";

async function stableScreenshot(page: Page, name: string) {
  await page.locator("main:not(.page-loading)").waitFor();
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.locator("img").evaluateAll(async (images) => {
    await Promise.all(
      images.map(async (image) => {
        if (image.complete) return;
        await new Promise<void>((resolve) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        });
      }),
    );
  });
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo(0, 0);
  });
  await page.waitForFunction(() => window.scrollY === 0);
  await expect(page).toHaveScreenshot(name, {
    animations: "disabled",
    caret: "hide",
    fullPage: false,
  });
}

test("critical Storefront visual baselines", async ({ page }) => {
  test.setTimeout(120_000);
  const cases = [
    ["home-desktop.png", "/", 1440, 900],
    ["home-mobile.png", "/", 390, 844],
    ["shop-desktop.png", "/shop", 1440, 900],
    ["shop-mobile.png", "/shop", 390, 844],
    ["pdp-desktop.png", `/product/${seed.productSlug}`, 1440, 900],
    ["pdp-mobile.png", `/product/${seed.productSlug}`, 390, 844],
    ["login.png", "/login", 1440, 900],
  ] as const;
  for (const [name, path, width, height] of cases) {
    await page.setViewportSize({ width, height });
    await page.goto(path);
    await stableScreenshot(page, name);
  }
});

test("Cart and Checkout visual baselines", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await addSeedProductToCart(page);
  await page.goto("/cart");
  await stableScreenshot(page, "cart-mobile.png");
  await fillCheckout(page, "0934567890");
  await stableScreenshot(page, "checkout-mobile.png");
  await page.setViewportSize({ width: 1440, height: 900 });
  await stableScreenshot(page, "checkout-desktop.png");
});

test("Product Advisor visual baselines", async ({ page }) => {
  test.skip(
    providerMode !== "live",
    "Live-provider visual state requires an approved canary.",
  );
  test.setTimeout(90_000);
  for (const [name, width, height] of [
    ["ai-advisor-desktop.png", 1440, 900],
    ["ai-advisor-mobile.png", 390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto("/shop");
    await page
      .getByRole("button", { name: "Mở FARTA Product Advisor" })
      .click();
    const dialog = page.getByRole("dialog", { name: "Product Advisor" });
    await dialog.getByRole("button", { name: "Tìm áo màu đen size M" }).click();
    await expect(
      dialog.getByRole("heading", { name: seed.productName }),
    ).toBeVisible();
    await stableScreenshot(page, name);
  }
});

test("Admin catalog and order detail visual baselines", async ({
  page,
  browser,
}) => {
  const order = await createOrderInNewContext(browser);
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginStaff(page);
  await page.goto(`${urls.admin}/products`);
  await expect(
    page.locator('.category-checklist input[type="checkbox"]').first(),
  ).toBeVisible();
  await expect(page.getByText(seed.productName, { exact: true })).toBeVisible();
  await stableScreenshot(page, "admin-catalog.png");
  await page.goto(`${urls.admin}/orders/${order.code}`);
  const orderHeading = page.getByRole("heading", { name: order.code });
  await expect(orderHeading).toBeVisible();
  await orderHeading.evaluate((heading) => {
    heading.textContent = "FAR-YYYYMMDD-XXXXXXXXXX";
  });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect(page).toHaveScreenshot("admin-order-detail.png", {
    animations: "disabled",
    caret: "hide",
    fullPage: false,
    mask: [page.locator("time"), page.locator("td small")],
    maskColor: "#d8d2c7",
  });
  await cancelBrowserOrder(page, order.code);
});
