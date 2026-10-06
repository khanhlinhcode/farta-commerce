import Link from "next/link";
import { Suspense } from "react";

import { CatalogFilters } from "./catalog-filters";
import { CatalogState } from "./catalog-states";
import { MediaFrame } from "./media-frame";
import { ProductGrid } from "./product-grid";
import type {
  CatalogQuery,
  CatalogResult,
  Category,
  Media,
  PaginatedProducts,
} from "@/lib/catalog";

function pageHref(basePath: string, query: CatalogQuery, page: number) {
  const params = new URLSearchParams();
  for (const key of [
    "q",
    "category",
    "size",
    "color",
    "minPrice",
    "maxPrice",
    "availability",
  ] as const) {
    const value = query[key];
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  if (page > 1) params.set("page", String(page));
  return `${basePath}${params.size ? `?${params}` : ""}`;
}

export function CatalogListing({
  eyebrow,
  title,
  description,
  result,
  categories = [],
  query,
  basePath,
  filters = false,
  heroMedia = null,
}: {
  eyebrow: string;
  title: string;
  description?: string | null;
  result: CatalogResult<PaginatedProducts>;
  categories?: Category[];
  query: CatalogQuery;
  basePath: string;
  filters?: boolean;
  heroMedia?: Media | null;
}) {
  const products = result.ok ? result.data : null;
  const pageCount = products
    ? Math.max(1, Math.ceil(products.total / products.limit))
    : 1;

  return (
    <main id="main-content" className="catalog-page">
      <header className={`catalog-hero${heroMedia ? " has-media" : ""}`}>
        <p>{eyebrow}</p>
        <h1>{title}</h1>
        {description && <div>{description}</div>}
        {heroMedia && (
          <figure className="catalog-hero__media">
            <MediaFrame media={heroMedia} fallbackLabel={title} priority />
          </figure>
        )}
      </header>
      <div className={filters ? "catalog-layout" : "catalog-layout is-wide"}>
        {filters && (
          <Suspense fallback={<div className="filters-skeleton" />}>
            <CatalogFilters categories={categories} basePath={basePath} />
          </Suspense>
        )}
        <section className="catalog-results" aria-labelledby="results-title">
          <div className="catalog-toolbar">
            <p id="results-title">
              {products ? `${products.total} sản phẩm` : "Danh mục FARTA"}
            </p>
            <span>Sắp xếp: Mới nhất</span>
          </div>
          {!result.ok ? (
            <CatalogState
              kind="error"
              title="Catalog đang tạm gián đoạn"
              detail="Không thể tải sản phẩm từ FARTA API. Vui lòng thử lại sau."
            />
          ) : result.data.items.length === 0 ? (
            <CatalogState
              kind="empty"
              title="Chưa tìm thấy thiết kế phù hợp"
              detail="Thử điều chỉnh bộ lọc hoặc khám phá toàn bộ cửa hàng."
            />
          ) : (
            <ProductGrid products={result.data.items} />
          )}
          {products && pageCount > 1 && (
            <nav className="pagination" aria-label="Phân trang sản phẩm">
              {products.page > 1 ? (
                <Link href={pageHref(basePath, query, products.page - 1)}>
                  ← Trang trước
                </Link>
              ) : (
                <span />
              )}
              <span>
                Trang {products.page} / {pageCount}
              </span>
              {products.page < pageCount ? (
                <Link href={pageHref(basePath, query, products.page + 1)}>
                  Trang sau →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </section>
      </div>
    </main>
  );
}
