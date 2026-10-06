import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/catalog", () => ({
  canOptimizeCloudinary: () => false,
  getBanners: vi.fn().mockResolvedValue({
    ok: true,
    data: { items: [] },
  }),
  getCategories: vi.fn().mockResolvedValue({
    ok: true,
    data: { items: [] },
  }),
  getProducts: vi.fn().mockResolvedValue({
    ok: true,
    data: { items: [], page: 1, limit: 4, total: 0 },
  }),
}));

import HomePage from "./page";

describe("premium storefront home", () => {
  it("uses honest fallback content when public catalog is empty", async () => {
    render(await HomePage());

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Chuyển động, được may đo.",
    );
    expect(
      screen.getByText("Bộ sưu tập mới đang được chuẩn bị"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Chưa có bộ sưu tập công khai"),
    ).toBeInTheDocument();
  });
});
