import { expect, type Browser, type Page } from "@playwright/test";

export const seed = {
  productName: "FARTA Essential Tee",
  productSlug: "dev-farta-essential-tee",
  categorySlug: "dev-farta-ao-thun",
} as const;

export const urls = {
  storefront: process.env.E2E_STOREFRONT_URL ?? "http://localhost:3000",
  admin: process.env.E2E_ADMIN_URL ?? "http://localhost:5173",
  api: process.env.E2E_API_URL ?? "http://localhost:4000",
} as const;

export function staffCredentials() {
  const email = process.env.E2E_STAFF_EMAIL?.trim();
  const password = process.env.E2E_STAFF_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "Browser Admin coverage requires E2E_STAFF_EMAIL and E2E_STAFF_PASSWORD from the local/CI secret environment.",
    );
  }
  return { email, password };
}

export async function assertNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(
    dimensions.clientWidth + 1,
  );
}

export async function addSeedProductToCart(page: Page) {
  await page.goto(`/product/${seed.productSlug}`);
  await expect(
    page.getByRole("heading", { name: seed.productName }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Kem" }).click();
  await page.getByRole("button", { name: "M", exact: true }).click();
  await page.getByRole("button", { name: "Thêm vào giỏ" }).click();
  await expect(
    page.getByText("Đã thêm lựa chọn này vào giỏ hàng."),
  ).toBeVisible();
}

export async function fillCheckout(page: Page, phone: string) {
  await page.goto("/checkout");
  await expect(
    page.getByRole("heading", { name: "Xác nhận lựa chọn." }),
  ).toBeVisible();
  await page.getByLabel("Họ tên").fill("Khách hàng Browser E2E");
  await page.getByLabel("Số điện thoại").fill(phone);
  await page.getByLabel("Địa chỉ").fill("12 Nguyễn Huệ");
  await page.getByLabel("Tỉnh / Thành phố").fill("TP. Hồ Chí Minh");
  await page.getByLabel("Quận / Huyện").fill("Quận 1");
  await page.getByLabel("Phường / Xã").fill("Bến Nghé");
  await page.getByLabel("Thanh toán khi nhận hàng (COD)").check();
}

export async function createGuestCodOrder(page: Page) {
  const phone = "0901234567";
  await addSeedProductToCart(page);
  await fillCheckout(page, phone);
  await page.getByRole("button", { name: /Đặt hàng COD/ }).click();
  await expect(page).toHaveURL(/\/order-confirmation\/FAR-/);
  const code = decodeURIComponent(
    new URL(page.url()).pathname.split("/").at(-1) ?? "",
  );
  await expect(page.getByText(`Đơn hàng ${code}`)).toBeVisible();
  return { code, phone };
}

export async function registerCustomer(page: Page) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const credentials = {
    email: `browser-${suffix}@example.test`,
    password: "FartaBrowser!2026",
  };
  await page.goto("/register");
  await page.getByLabel("Họ tên").fill("Linh Browser");
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Mật khẩu").fill(credentials.password);
  await page.getByRole("button", { name: "Tạo tài khoản" }).click();
  await expect(page).toHaveURL(/\/account$/);
  return credentials;
}

export async function loginStaff(page: Page) {
  const credentials = staffCredentials();
  await page.goto(`${urls.admin}/login`);
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Mật khẩu").fill(credentials.password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL(`${urls.admin}/`, { timeout: 30_000 });
  await expect(
    page.getByRole("heading", { name: "Tổng quan catalog" }),
  ).toBeVisible();
}

export async function cancelBrowserOrder(page: Page, orderCode: string) {
  const status = await page.evaluate(async (code) => {
    const csrf = document.cookie
      .split("; ")
      .find((entry) => /^(?:__Secure-)?farta_staff_csrf=/.test(entry))
      ?.split("=")
      .slice(1)
      .join("=");
    if (!csrf) throw new Error("Staff CSRF cookie is missing");
    const response = await fetch(
      `/api/v1/admin/orders/${encodeURIComponent(code)}/cancel`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": decodeURIComponent(csrf),
        },
        body: JSON.stringify({ reason: "Browser E2E cleanup" }),
      },
    );
    return response.status;
  }, orderCode);
  expect(status).toBe(201);
}

export async function cancelBrowserOrderInNewContext(
  browser: Browser,
  orderCode: string,
) {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await loginStaff(page);
    await cancelBrowserOrder(page, orderCode);
  } finally {
    await context.close();
  }
}

export async function createOrderInNewContext(browser: Browser) {
  const context = await browser.newContext({ baseURL: urls.storefront });
  const page = await context.newPage();
  const order = await createGuestCodOrder(page);
  await context.close();
  return order;
}
