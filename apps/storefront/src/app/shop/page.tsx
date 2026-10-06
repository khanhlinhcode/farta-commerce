import type { Metadata } from "next";

import { CatalogListing } from "@/components/storefront/catalog-listing";
import { getCategories, getProducts, parseCatalogQuery } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Shop",
  description: "Khám phá toàn bộ thiết kế đang hoạt động của FARTA.",
  alternates: { canonical: "/shop" },
};

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = parseCatalogQuery(await searchParams);
  const [products, categories] = await Promise.all([
    getProducts(query),
    getCategories(),
  ]);

  return (
    <CatalogListing
      eyebrow="FARTA / Catalog"
      title="Shop"
      description="Phom dáng hiện đại, tỷ lệ tinh gọn và chất liệu được lựa chọn cho nhịp sống thành thị."
      result={products}
      categories={categories.ok ? categories.data.items : []}
      query={query}
      basePath="/shop"
      filters
    />
  );
}
