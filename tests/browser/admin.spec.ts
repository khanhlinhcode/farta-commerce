import { expect, test } from "@playwright/test";

import {
  cancelBrowserOrder,
  createOrderInNewContext,
  loginStaff,
  seed,
  urls,
} from "./support";

test.use({ trace: "off" });

test("unauthenticated Admin UI and API remain protected", async ({
  page,
  request,
}) => {
  await page.goto(`${urls.admin}/orders`);
  await expect(page).toHaveURL(`${urls.admin}/login`);
  const response = await request.get(`${urls.api}/api/v1/admin/orders`);
  expect(response.status()).toBe(401);
});

test("Staff login UI reports invalid credentials without exposing internals", async ({
  page,
}) => {
  await page.goto(`${urls.admin}/login`);
  await page.getByLabel("Email").fill("invalid-staff@example.test");
  await page.getByLabel("Mật khẩu").fill("InvalidBrowserPassword!2026");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Thông tin đăng nhập không hợp lệ",
  );
});

test("Staff can inspect seeded catalog and inventory", async ({ page }) => {
  await loginStaff(page);
  await page.getByRole("link", { name: "Sản phẩm" }).click();
  await expect(page.getByText(seed.productName)).toBeVisible();
  await page
    .getByRole("row", { name: new RegExp(seed.productName) })
    .getByRole("link", { name: "Variants & tồn kho" })
    .click();
  await expect(page.getByText("DEV-FAR-TEE-BLK-M")).toBeVisible();
  await expect(page.getByText(/khả dụng/).first()).toBeVisible();
});

test("Admin order detail enforces allowed and invalid transitions", async ({
  page,
  browser,
}) => {
  const order = await createOrderInNewContext(browser);
  await loginStaff(page);
  await page.getByRole("link", { name: "Đơn hàng" }).click();
  await page.getByRole("link", { name: order.code }).click();
  await expect(page.getByRole("heading", { name: order.code })).toBeVisible();

  const invalid = await page.evaluate(async (orderCode) => {
    const csrf = document.cookie
      .split("; ")
      .find((entry) => /^(?:__Secure-)?farta_staff_csrf=/.test(entry))
      ?.split("=")
      .slice(1)
      .join("=");
    if (!csrf) throw new Error("Staff CSRF cookie is missing");
    const response = await fetch(
      `/api/v1/admin/orders/${encodeURIComponent(orderCode)}/status`,
      {
        method: "PATCH",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": decodeURIComponent(csrf),
        },
        body: JSON.stringify({
          status: "PACKING",
          reason: "Browser negative test",
        }),
      },
    );
    return response.status;
  }, order.code);
  expect(invalid).toBe(409);

  await page
    .getByLabel("Lý do bắt buộc")
    .fill("Đã xác nhận thông tin giao nhận");
  await page.getByLabel("Chuyển trạng thái").selectOption("CONFIRMED");
  await page.getByRole("button", { name: "Cập nhật trạng thái" }).click();
  await expect(page.getByText("CONFIRMED").first()).toBeVisible();
  await page.reload();
  await expect(page.getByText("CONFIRMED").first()).toBeVisible();
  await cancelBrowserOrder(page, order.code);
});
