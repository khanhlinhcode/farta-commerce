import { expect, test } from "@playwright/test";

import {
  addSeedProductToCart,
  assertNoHorizontalOverflow,
  loginStaff,
  seed,
  urls,
} from "./support";

const viewports = [
  { width: 320, height: 568 },
  { width: 360, height: 800 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
] as const;

test("Storefront release routes have no horizontal page overflow at required widths", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await addSeedProductToCart(page);
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const path of [
      "/",
      "/shop",
      `/product/${seed.productSlug}`,
      "/cart",
      "/checkout",
      "/order-lookup",
      "/login",
    ]) {
      await page.goto(path);
      await expect(page.locator("main:not(.page-loading)")).toBeVisible();
      await assertNoHorizontalOverflow(page);
    }
  }
});

test("mobile menu, Search and filter drawer manage keyboard focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const menu = page.getByRole("button", { name: "Mở menu" });
  await menu.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "Menu di động" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Đóng menu" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();

  const search = page.getByRole("button", { name: "Mở tìm kiếm" });
  await expect(search).toBeVisible();
  await search.click();
  await expect(page.getByLabel("Từ khóa tìm kiếm")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(search).toBeFocused();

  await page.goto("/shop");
  const filter = page.getByRole("button", { name: "Bộ lọc" });
  await filter.click();
  await expect(page.getByRole("dialog", { name: "Bộ lọc" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Đóng bộ lọc" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(filter).toBeFocused();
});

test("forms expose labels, validation associations, touch targets and reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/register");
  await page.getByRole("button", { name: "Tạo tài khoản" }).click();
  const email = page.getByLabel("Email");
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await expect(email).toHaveAttribute("aria-describedby", /.+/);

  await page.goto(`/product/${seed.productSlug}`);
  for (const control of await page
    .locator(".choice-row button, .size-row button")
    .all()) {
    const box = await control.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  const duration = await page
    .locator(".product-card")
    .first()
    .evaluate((element) => getComputedStyle(element).transitionDuration)
    .catch(() => "0s");
  expect(["0s", "0.00001s", "0.01ms"]).toContain(duration);
});

test("Admin tables and forms stay contained across representative widths", async ({
  page,
}) => {
  await loginStaff(page);
  for (const viewport of [viewports[0], viewports[5], viewports[7]]) {
    await page.setViewportSize(viewport);
    for (const path of ["/categories", "/products", "/media", "/orders"]) {
      await page.goto(`${urls.admin}${path}`);
      await expect(page.locator("main.admin-content")).toBeVisible();
      await assertNoHorizontalOverflow(page);
    }
  }
});
