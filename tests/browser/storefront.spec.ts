import { expect, test } from "@playwright/test";

import {
  addSeedProductToCart,
  assertNoHorizontalOverflow,
  cancelBrowserOrderAsStaff,
  fillCheckout,
  prepareBrowserOrderCancellation,
  registerCustomer,
  seed,
} from "./support";

test("Home → New Arrivals → Product uses the development catalog", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Quiet Form/ })).toBeVisible();
  await page.getByRole("link", { name: "Khám phá bộ sưu tập" }).click();
  await expect(page).toHaveURL(/\/new-arrivals/);
  await page.getByRole("link", { name: `Xem ${seed.productName}` }).click();
  await expect(
    page.getByRole("heading", { name: seed.productName }),
  ).toBeVisible();
});

test("PDP keeps gallery, variant state and Cart selection synchronized", async ({
  page,
}) => {
  await page.goto(`/product/${seed.productSlug}`);
  const primaryImage = page.locator(".product-gallery__primary img");
  await expect(primaryImage).toHaveAttribute("alt", /màu đen/i);

  const cream = page.getByRole("button", { name: "Kem", exact: true });
  await cream.focus();
  await page.keyboard.press("Enter");

  await expect(cream).toHaveAttribute("aria-pressed", "true");
  await expect(primaryImage).toHaveAttribute("alt", /màu kem/i);
  await page.getByRole("button", { name: "M", exact: true }).click();
  await expect(page.getByText("Còn hàng")).toBeVisible();
  await page.getByRole("button", { name: "Thêm vào giỏ" }).click();
  await expect(
    page.getByText("Đã thêm lựa chọn này vào giỏ hàng."),
  ).toBeVisible();

  await page.getByRole("link", { name: /Giỏ hàng, 1 sản phẩm/ }).click();
  await expect(page.getByText("Kem · M")).toBeVisible();
});

test("Shop filter, supported sort and Search resolve real products", async ({
  page,
}) => {
  await page.goto("/shop");
  await page.getByLabel("Kích cỡ").selectOption("M");
  await page.getByRole("button", { name: "Áp dụng" }).click();
  await expect(page).toHaveURL(/size=M/);
  await expect(page.getByText("Sắp xếp: Mới nhất")).toBeVisible();
  await expect(page.getByText(seed.productName).first()).toBeVisible();

  await page.getByRole("button", { name: "Mở tìm kiếm" }).click();
  await page.getByLabel("Từ khóa tìm kiếm").fill("Essential Tee");
  await page.getByRole("button", { name: "Tìm kiếm", exact: true }).click();
  await expect(page).toHaveURL(/\/search\?q=Essential/);
  await expect(page.getByText(seed.productName).first()).toBeVisible();
});

test("variant selection, Cart update and removal remain server authoritative", async ({
  page,
}) => {
  await addSeedProductToCart(page);
  await page.getByRole("link", { name: /Giỏ hàng, 1 sản phẩm/ }).click();
  await expect(page.getByRole("heading", { name: "Giỏ hàng" })).toBeVisible();
  await page.getByRole("button", { name: "Tăng số lượng" }).click();
  await expect(page.getByText("2 sản phẩm đã chọn")).toBeVisible();
  await page.getByRole("button", { name: "Giảm số lượng" }).click();
  await expect(page.getByText("1 sản phẩm đã chọn")).toBeVisible();
  await page.getByRole("button", { name: "Xóa", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /Giỏ hàng đang đợi/ }),
  ).toBeVisible();
});

test("guest COD checkout supports safe lookup", async ({ page }) => {
  await addSeedProductToCart(page);
  await fillCheckout(page, "0901234567");
  await page.getByRole("button", { name: /Đặt hàng COD/ }).click();
  await expect(page).toHaveURL(/\/order-confirmation\/FAR-/);
  const code = decodeURIComponent(
    new URL(page.url()).pathname.split("/").at(-1) ?? "",
  );
  await page.goto("/order-lookup");
  await page.getByLabel("Mã đơn hàng").fill(code);
  await page.getByLabel("Số điện thoại người nhận").fill("0901234567");
  await page.getByRole("button", { name: "Tra cứu đơn hàng" }).click();
  await expect(page.getByText(`Đơn hàng ${code}`)).toBeVisible();
  await expect(page.getByText("Thông tin được bảo vệ")).toBeVisible();
  await cancelBrowserOrderAsStaff(code);
});

test("guest Cart merges on registration and customer order survives re-login", async ({
  page,
}) => {
  const cancelOrder = prepareBrowserOrderCancellation();
  await addSeedProductToCart(page);
  const credentials = await registerCustomer(page);
  await page.goto("/cart");
  await expect(page.getByText(seed.productName)).toBeVisible();
  await fillCheckout(page, "0912345678");
  await page.getByRole("button", { name: /Đặt hàng COD/ }).click();
  await expect(page).toHaveURL(/\/order-confirmation\/FAR-/);
  const code = decodeURIComponent(
    new URL(page.url()).pathname.split("/").at(-1) ?? "",
  );

  await page.goto("/account/security");
  await page.getByRole("button", { name: "Đăng xuất thiết bị này" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Mật khẩu").fill(credentials.password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await page.goto("/account/orders");
  await page.getByRole("link", { name: new RegExp(code) }).click();
  await expect(page).toHaveURL(new RegExp(`/account/orders/${code}$`));
  await expect(page.getByText(`Đơn hàng ${code}`)).toBeVisible();
  await cancelOrder(code);
});

test("concurrent duplicate checkout creates one logical order", async ({
  page,
}) => {
  await addSeedProductToCart(page);
  await page.goto("/checkout");
  const result = await page.evaluate(async () => {
    const csrf = document.cookie
      .split("; ")
      .find((entry) => /^(?:__Secure-)?farta_customer_csrf=/.test(entry))
      ?.split("=")
      .slice(1)
      .join("=");
    const headers = {
      "content-type": "application/json",
      ...(csrf ? { "x-csrf-token": decodeURIComponent(csrf) } : {}),
    };
    const previewResponse = await fetch("/api/v1/checkout/preview", {
      method: "POST",
      credentials: "include",
      headers,
      body: "{}",
    });
    const preview = (await previewResponse.json()) as { quoteToken: string };
    const body = JSON.stringify({
      recipientName: "Khách E2E Retry",
      phone: "0923456789",
      addressLine: "22 Lê Lợi",
      provinceCity: "TP. Hồ Chí Minh",
      district: "Quận 1",
      ward: "Bến Thành",
      shippingMethod: "STANDARD",
      paymentMethod: "COD",
      quoteToken: preview.quoteToken,
    });
    const idempotencyKey = crypto.randomUUID();
    const responses = await Promise.all(
      [0, 1].map(() =>
        fetch("/api/v1/checkout", {
          method: "POST",
          credentials: "include",
          headers: { ...headers, "idempotency-key": idempotencyKey },
          body,
        }),
      ),
    );
    return Promise.all(
      responses.map(async (response) => ({
        status: response.status,
        body: (await response.json()) as { orderCode?: string },
      })),
    );
  });
  expect(result.map((entry) => entry.status)).toEqual([201, 201]);
  expect(new Set(result.map((entry) => entry.body.orderCode)).size).toBe(1);
  const orderCode = result[0]?.body.orderCode;
  expect(orderCode).toBeTruthy();
  await cancelBrowserOrderAsStaff(orderCode!);
  await assertNoHorizontalOverflow(page);
});
