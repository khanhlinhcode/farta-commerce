import { ArrowRight, Search, ShoppingBag } from "lucide-react";
import Link from "next/link";

import { Container, GlassSurface } from "@farta/ui";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-10 px-3 pt-3">
        <GlassSurface className="mx-auto flex min-h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link
            className="font-[var(--farta-font-display)] text-xl tracking-[0.28em]"
            href="/"
            aria-label="FARTA - Trang chủ"
          >
            FARTA
          </Link>
          <nav
            aria-label="Điều hướng chính"
            className="hidden items-center gap-7 text-sm md:flex"
          >
            <span>New arrivals</span>
            <span>Shop</span>
            <span>Collections</span>
          </nav>
          <div className="flex items-center gap-2" aria-label="Công cụ">
            <button
              className="grid size-11 place-items-center rounded-full"
              aria-label="Tìm kiếm"
            >
              <Search size={18} />
            </button>
            <button
              className="grid size-11 place-items-center rounded-full"
              aria-label="Giỏ hàng"
            >
              <ShoppingBag size={18} />
            </button>
          </div>
        </GlassSurface>
      </header>
      <Container className="grid min-h-[calc(100vh-5rem)] items-end gap-10 py-16 lg:grid-cols-[1.15fr_0.85fr] lg:py-24">
        <section aria-labelledby="phase-one-title" className="max-w-3xl">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.25em] text-[var(--farta-color-accent)]">
            Engineering foundation
          </p>
          <h1
            id="phase-one-title"
            className="font-[var(--farta-font-display)] text-6xl leading-[0.94] tracking-[-0.045em] sm:text-7xl lg:text-8xl"
          >
            Fashion, with a quieter point of view.
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-[var(--farta-color-text-muted)]">
            Đây là shell Phase 1 — chưa phải homepage cuối. Commerce,
            authentication và campaign content sẽ chỉ xuất hiện khi domain và
            security gates tương ứng hoàn tất.
          </p>
          <div className="mt-9 inline-flex items-center gap-3 border-b border-[var(--farta-color-text)] pb-2 text-sm font-semibold">
            Khám phá nền tảng <ArrowRight size={17} aria-hidden="true" />
          </div>
        </section>
        <aside
          className="rounded-[var(--farta-radius-lg)] bg-[var(--farta-color-accent)] p-8 text-white sm:p-10"
          aria-label="Trạng thái dự án"
        >
          <p className="text-xs uppercase tracking-[0.22em] text-white/70">
            Phase 1
          </p>
          <p className="mt-16 font-[var(--farta-font-display)] text-4xl leading-tight">
            A deliberate shell. No fake catalog. No fake checkout.
          </p>
          <p className="mt-5 text-sm leading-6 text-white/72">
            API contracts, security controls and real product data arrive
            through gated phases.
          </p>
        </aside>
      </Container>
    </main>
  );
}
