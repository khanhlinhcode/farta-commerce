"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  ChevronDown,
  Menu,
  Search,
  ShoppingBag,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import type { Category } from "@/lib/catalog";
import { cartQueryKey, getCart } from "@/lib/cart";

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
  const [hydrated, setHydrated] = useState(false);
  const [scrolled, setScrolled] = useState(false);
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
  const cart = useQuery({
    queryKey: cartQueryKey,
    queryFn: getCart,
    staleTime: 15_000,
    retry: false,
  });

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
    setHydrated(true);
  }, []);

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

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 24);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <>
      <header
        className={`site-header${pathname === "/" ? " site-header--home" : ""}${scrolled ? " is-scrolled" : ""}`}
      >
        <div className="site-header__inner">
          <button
            ref={menuTrigger}
            className="icon-button mobile-only"
            aria-label="Mở menu"
            aria-expanded={menuOpen}
            disabled={!hydrated}
            onClick={() => setMenuOpen(true)}
            type="button"
          >
            <Menu aria-hidden="true" size={20} />
          </button>
          <Link
            className="wordmark"
            href="/"
            prefetch={false}
            aria-label="FARTA — Trang chủ"
          >
            FARTA
          </Link>
          <nav className="desktop-nav" aria-label="Điều hướng chính">
            {links.map(([href, label]) => (
              <Link
                aria-current={pathname === href ? "page" : undefined}
                href={href}
                key={href}
                prefetch={false}
              >
                {label}
              </Link>
            ))}
            {categoryItems.length > 0 && (
              <details className="category-nav">
                <summary>
                  Danh mục
                  <ChevronDown aria-hidden="true" size={14} strokeWidth={1.5} />
                </summary>
                <div>
                  {categoryItems.map((category) => (
                    <Link
                      href={`/category/${category.slug}`}
                      key={category.id}
                      prefetch={false}
                    >
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
              disabled={!hydrated}
              onClick={() => setSearchOpen(true)}
              type="button"
            >
              <Search aria-hidden="true" size={19} />
              <span className="search-label">Tìm kiếm</span>
            </button>
            <Link
              className="icon-button"
              href="/account"
              prefetch={false}
              aria-label="Tài khoản"
            >
              <UserRound aria-hidden="true" size={19} />
            </Link>
            <Link
              className="icon-button cart-link"
              href="/cart"
              prefetch={false}
              aria-label={`Giỏ hàng, ${cart.data?.itemCount ?? 0} sản phẩm`}
            >
              <ShoppingBag aria-hidden="true" size={19} />
              {(cart.data?.itemCount ?? 0) > 0 && (
                <span aria-hidden="true">{cart.data?.itemCount}</span>
              )}
            </Link>
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
                <Link href={href} key={href} prefetch={false}>
                  {label}
                  <ArrowUpRight
                    aria-hidden="true"
                    size={18}
                    strokeWidth={1.5}
                  />
                </Link>
              ))}
              {categoryItems.map((category) => (
                <Link
                  href={`/category/${category.slug}`}
                  key={category.id}
                  prefetch={false}
                >
                  {category.name}
                  <ArrowUpRight
                    aria-hidden="true"
                    size={18}
                    strokeWidth={1.5}
                  />
                </Link>
              ))}
              <Link href="/login" prefetch={false}>
                Đăng nhập
                <ArrowUpRight aria-hidden="true" size={18} strokeWidth={1.5} />
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
