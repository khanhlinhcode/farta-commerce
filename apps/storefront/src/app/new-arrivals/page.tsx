import type { Metadata } from "next";

import { CatalogListing } from "@/components/storefront/catalog-listing";
import { getProducts, parseCatalogQuery } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Hàng mới",
  description: "Những thiết kế mới nhất từ FARTA.",
  alternates: { canonical: "/new-arrivals" },
};

export default async function NewArrivalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = parseCatalogQuery(await searchParams);
  const products = await getProducts(query);

  return (
    <CatalogListing
      eyebrow="Just in / Current season"
      title="Hàng mới"
      description="Những đường nét vừa xuất hiện trong catalog FARTA, theo thứ tự phát hành mới nhất."
      result={products}
      query={query}
      basePath="/new-arrivals"
    />
  );
}
