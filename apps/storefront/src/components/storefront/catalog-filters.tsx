"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import type { Category } from "@/lib/catalog";

function trapFocus(event: ReactKeyboardEvent<HTMLElement>) {
  if (event.key !== "Tab") return;
  const focusable = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
  const first = focusable[0];
  const last = focusable.at(-1);
  if (!first || !last) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export function CatalogFilters({
  categories,
  basePath = "/shop",
}: {
  categories: Category[];
  basePath?: string;
}) {
  const router = useRouter();
  const current = useSearchParams();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => close.current?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      requestAnimationFrame(() => trigger.current?.focus());
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function closeDrawer() {
    setOpen(false);
    requestAnimationFrame(() => trigger.current?.focus());
  }

  function apply(formData: FormData) {
    const next = new URLSearchParams(current.toString());
    for (const key of [
      "category",
      "size",
      "color",
      "minPrice",
      "maxPrice",
      "availability",
    ]) {
      const value = String(formData.get(key) ?? "").trim();
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete("page");
    router.push(`${basePath}${next.size ? `?${next}` : ""}`);
    setOpen(false);
  }

  const form = (
    <form className="filter-form" action={apply}>
      <label>
        Danh mục
        <select name="category" defaultValue={current.get("category") ?? ""}>
          <option value="">Tất cả</option>
          {categories.map((category) => (
            <option key={category.id} value={category.slug}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Kích cỡ
        <select name="size" defaultValue={current.get("size") ?? ""}>
          <option value="">Tất cả</option>
          {["XS", "S", "M", "L", "XL"].map((size) => (
            <option key={size}>{size}</option>
          ))}
        </select>
      </label>
      <label>
        Màu sắc
        <input
          name="color"
          defaultValue={current.get("color") ?? ""}
          maxLength={80}
          placeholder="Ví dụ: Black"
        />
      </label>
      <div className="filter-form__row">
        <label>
          Giá từ
          <input
            inputMode="numeric"
            name="minPrice"
            defaultValue={current.get("minPrice") ?? ""}
          />
        </label>
        <label>
          Đến
          <input
            inputMode="numeric"
            name="maxPrice"
            defaultValue={current.get("maxPrice") ?? ""}
          />
        </label>
      </div>
      <label>
        Tình trạng
        <select
          name="availability"
          defaultValue={current.get("availability") ?? ""}
        >
          <option value="">Tất cả</option>
          <option value="IN_STOCK">Còn hàng</option>
          <option value="LOW_STOCK">Sắp hết</option>
          <option value="OUT_OF_STOCK">Hết hàng</option>
        </select>
      </label>
      <div className="filter-form__actions">
        <button className="button button--primary" type="submit">
          Áp dụng
        </button>
        <button
          className="button button--quiet"
          type="button"
          onClick={() => router.push(basePath)}
        >
          Xóa lọc
        </button>
      </div>
    </form>
  );

  return (
    <>
      <aside className="filters-desktop" aria-label="Bộ lọc sản phẩm">
        <h2>Bộ lọc</h2>
        {form}
      </aside>
      <button
        ref={trigger}
        className="filter-trigger"
        onClick={() => setOpen(true)}
        type="button"
      >
        <SlidersHorizontal size={18} /> Bộ lọc
      </button>
      {open && (
        <div className="overlay" onMouseDown={closeDrawer} role="presentation">
          <aside
            className="drawer drawer--end"
            role="dialog"
            aria-modal="true"
            aria-labelledby="filter-title"
            onKeyDown={trapFocus}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="drawer__header">
              <h2 id="filter-title">Bộ lọc</h2>
              <button
                ref={close}
                className="icon-button"
                type="button"
                onClick={closeDrawer}
                aria-label="Đóng bộ lọc"
              >
                <X size={20} />
              </button>
            </div>
            {form}
          </aside>
        </div>
      )}
    </>
  );
}
