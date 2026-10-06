"use client";

import { useQuery } from "@tanstack/react-query";
import { Menu, Search, ShoppingBag, UserRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import type { Category } from "@/lib/catalog";

const links = [
  ["/shop", "Shop"],
  ["/new-arrivals", "Hàng mới"],
  ["/collections", "Bộ sưu tập"],
] as const;

function trapFocus(event: ReactKeyboardEvent<HTMLElement>) {
  if (event.key !== "Tab") return;
  const focusable = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
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

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const menuClose = useRef<HTMLButtonElement>(null);
  const searchTrigger = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const categories = useQuery({
    queryKey: ["public-categories", "navigation"],
    queryFn: async () => {
      const response = await fetch("/api/v1/categories", {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("CATEGORY_NAV_UNAVAILABLE");
      return response.json() as Promise<{ items: Category[] }>;
    },
    staleTime: 60_000,
    retry: false,
  });
  const categoryItems = categories.data?.items.slice(0, 8) ?? [];

  function closeMenu(restoreFocus = true) {
    setMenuOpen(false);
    if (restoreFocus) requestAnimationFrame(() => menuTrigger.current?.focus());
  }

  function closeSearch(restoreFocus = true) {
    setSearchOpen(false);
    if (restoreFocus)
      requestAnimationFrame(() => searchTrigger.current?.focus());
  }

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen && !searchOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (menuOpen) {
          setMenuOpen(false);
          requestAnimationFrame(() => menuTrigger.current?.focus());
        }
        if (searchOpen) {
          setSearchOpen(false);
          requestAnimationFrame(() => searchTrigger.current?.focus());
        }
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (menuOpen) requestAnimationFrame(() => menuClose.current?.focus());
    if (searchOpen) requestAnimationFrame(() => searchInput.current?.focus());
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, searchOpen]);

  return (
    <>
      <header className="site-header">
        <div className="site-header__inner">
          <button
            ref={menuTrigger}
            className="icon-button mobile-only"
            aria-label="Mở menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
            type="button"
          >
            <Menu aria-hidden="true" size={20} />
          </button>
          <Link className="wordmark" href="/" aria-label="FARTA — Trang chủ">
            FARTA
          </Link>
          <nav className="desktop-nav" aria-label="Điều hướng chính">
            {links.map(([href, label]) => (
              <Link
                aria-current={pathname === href ? "page" : undefined}
                href={href}
                key={href}
              >
                {label}
              </Link>
            ))}
            {categoryItems.length > 0 && (
              <details className="category-nav">
                <summary>Danh mục</summary>
                <div>
                  {categoryItems.map((category) => (
                    <Link href={`/category/${category.slug}`} key={category.id}>
                      {category.name}
                    </Link>
                  ))}
                </div>
              </details>
            )}
          </nav>
          <div className="header-tools">
            <button
              ref={searchTrigger}
              className="icon-button"
              aria-label="Mở tìm kiếm"
              onClick={() => setSearchOpen(true)}
              type="button"
            >
              <Search aria-hidden="true" size={19} />
            </button>
            <Link
              className="icon-button"
              href="/account"
              aria-label="Tài khoản"
            >
              <UserRound aria-hidden="true" size={19} />
            </Link>
            <span
              className="icon-button is-disabled"
              aria-label="Giỏ hàng sẽ khả dụng ở Phase 4"
              title="Giỏ hàng đang được hoàn thiện"
            >
              <ShoppingBag aria-hidden="true" size={19} />
            </span>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div
          className="overlay"
          role="presentation"
          onMouseDown={() => closeMenu()}
        >
          <aside
            className="drawer drawer--start"
            role="dialog"
            aria-modal="true"
            aria-label="Menu di động"
            onKeyDown={trapFocus}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="drawer__header">
              <span className="wordmark">FARTA</span>
              <button
                ref={menuClose}
                className="icon-button"
                onClick={() => closeMenu()}
                aria-label="Đóng menu"
                type="button"
              >
                <X size={20} />
              </button>
            </div>
            <nav className="mobile-nav" aria-label="Điều hướng di động">
              {links.map(([href, label]) => (
                <Link href={href} key={href}>
                  {label}
                  <span aria-hidden="true">↗</span>
                </Link>
              ))}
              {categoryItems.map((category) => (
                <Link href={`/category/${category.slug}`} key={category.id}>
                  {category.name}
                  <span aria-hidden="true">↗</span>
                </Link>
              ))}
              <Link href="/login">
                Đăng nhập<span aria-hidden="true">↗</span>
              </Link>
            </nav>
          </aside>
        </div>
      )}

      {searchOpen && (
        <div
          className="overlay overlay--search"
          role="presentation"
          onMouseDown={() => closeSearch()}
        >
          <section
            className="search-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="search-title"
            onKeyDown={trapFocus}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="search-panel__top">
              <h2 id="search-title">Tìm trong FARTA</h2>
              <button
                className="icon-button"
                onClick={() => closeSearch()}
                aria-label="Đóng tìm kiếm"
                type="button"
              >
                <X size={20} />
              </button>
            </div>
            <form action="/search" className="search-form">
              <Search aria-hidden="true" size={22} />
              <label className="sr-only" htmlFor="global-search">
                Từ khóa tìm kiếm
              </label>
              <input
                ref={searchInput}
                id="global-search"
                name="q"
                placeholder="Tên sản phẩm, phom dáng, chất liệu…"
                maxLength={100}
              />
              <button type="submit">Tìm kiếm</button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
