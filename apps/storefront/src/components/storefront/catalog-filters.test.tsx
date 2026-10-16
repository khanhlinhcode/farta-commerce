import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CatalogFilters } from "./catalog-filters";

const mocks = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => new URLSearchParams("category=tees&page=2"),
}));

describe("CatalogFilters mobile drawer", () => {
  const categories = [
    {
      id: "category-1",
      name: "Tees",
      slug: "tees",
      description: null,
      imageMediaId: null,
      image: null,
      parentCategoryId: null,
      status: "ACTIVE",
      sortOrder: 1,
      seo: { title: null, description: null },
    },
  ];
  beforeEach(() => {
    mocks.push.mockReset();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    document.body.style.overflow = "";
  });

  it("clears filters, closes and restores focus to the trigger", () => {
    render(<CatalogFilters categories={categories} />);
    const trigger = screen.getByRole("button", { name: "Bộ lọc" });
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Bộ lọc" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Xóa lọc" }));
    expect(mocks.push).toHaveBeenCalledWith("/shop");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe("");
  });

  it("applies filters, closes and restores focus", () => {
    render(<CatalogFilters categories={categories} />);
    const trigger = screen.getByRole("button", { name: "Bộ lọc" });
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Bộ lọc" });
    fireEvent.change(within(dialog).getByLabelText("Kích cỡ"), {
      target: { value: "M" },
    });
    fireEvent.submit(
      within(dialog).getByRole("button", { name: "Áp dụng" }).closest("form")!,
    );
    expect(mocks.push).toHaveBeenCalledWith("/shop?category=tees&size=M");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
