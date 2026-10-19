import { expect, test } from "@playwright/test";

import { assertNoHorizontalOverflow, seed, urls } from "./support";

test("guest uses the deterministic Product Advisor and opens an authoritative product", async ({
  page,
}) => {
  await page.goto("/shop");
  const trigger = page.getByRole("button", {
    name: "Mở FARTA Product Advisor",
  });
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "Product Advisor" });
  await expect(dialog).toBeVisible();
  await expect(page.getByLabel("Câu hỏi về sản phẩm")).toBeFocused();
  await dialog.getByRole("button", { name: "Tìm áo màu đen size M" }).click();

  await expect(
    dialog.getByText("FARTA tìm thấy 1 sản phẩm phù hợp."),
  ).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: seed.productName }),
  ).toBeVisible();
  await dialog.getByRole("link", { name: "Xem sản phẩm" }).click();
  await expect(page).toHaveURL(new RegExp(`/product/${seed.productSlug}$`));
  await expect(
    page.getByRole("heading", { name: seed.productName }),
  ).toBeVisible();
});

test("provider-off advice fails closed without fabricating recommendations", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Mở FARTA Product Advisor" }).click();
  await page
    .getByLabel("Câu hỏi về sản phẩm")
    .fill("Tư vấn một outfit thanh lịch cho buổi tối cuối tuần");
  await page.getByRole("button", { name: "Gửi câu hỏi" }).click();

  await expect(page.getByText(/Tư vấn nâng cao đang tạm tắt/)).toBeVisible();
  await expect(page.getByLabel("Sản phẩm từ hệ thống FARTA")).toHaveCount(0);
});

test("Product Advisor is mobile-safe, restores focus, and stays outside checkout", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/shop");
  const trigger = page.getByRole("button", {
    name: "Mở FARTA Product Advisor",
  });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Product Advisor" });
  await expect(dialog).toBeVisible();
  await assertNoHorizontalOverflow(page);
  const bounds = await dialog.boundingBox();
  expect(bounds?.x ?? -1).toBeGreaterThanOrEqual(0);
  expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(320);

  await page.getByRole("button", { name: "Đóng trợ lý" }).click();
  await expect(trigger).toBeFocused();
  await page.goto("/checkout");
  await expect(
    page.getByRole("button", { name: "Mở FARTA Product Advisor" }),
  ).toHaveCount(0);
});

test("AI browser boundary rejects untrusted origins and unsigned internal tools", async ({
  request,
}) => {
  const untrusted = await request.post(`${urls.api}/api/v1/ai/chat`, {
    headers: { origin: "https://attacker.example" },
    data: { message: "Tìm áo màu đen size M" },
  });
  expect(untrusted.status()).toBe(403);

  const unsignedTool = await request.post(
    `${urls.api}/api/v1/internal/ai/tools/search-products`,
    { data: { keyword: "áo", limit: 6 } },
  );
  expect(unsignedTool.status()).toBe(401);
  expect(await unsignedTool.text()).not.toMatch(
    /\b(stack|node_modules|MongoServer|AI_TOOLS_SHARED_SECRET)\b/i,
  );
});
