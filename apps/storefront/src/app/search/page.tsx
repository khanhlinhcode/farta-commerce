import type { Metadata } from "next";

import { CatalogListing } from "@/components/storefront/catalog-listing";
import { getProducts, parseCatalogQuery } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Tìm kiếm",
  robots: { index: false, follow: true },
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = parseCatalogQuery(await searchParams);
  const result = query.q
    ? await getProducts(query)
    : { ok: true as const, data: { items: [], page: 1, limit: 24, total: 0 } };

  return (
    <CatalogListing
      eyebrow="Search / FARTA"
      title={query.q ? `“${query.q}”` : "Tìm kiếm"}
      description={
        query.q
          ? "Kết quả được truy vấn từ public Catalog API."
          : "Nhập từ khóa từ biểu tượng tìm kiếm trên thanh điều hướng."
      }
      result={result}
      query={query}
      basePath="/search"
    />
  );
}
