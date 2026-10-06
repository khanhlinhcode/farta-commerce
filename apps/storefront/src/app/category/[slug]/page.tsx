import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CatalogListing } from "@/components/storefront/catalog-listing";
import { getCategory, getProducts, parseCatalogQuery } from "@/lib/catalog";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category.ok) return { title: "Danh mục" };
  return {
    title: category.data.seo.title ?? category.data.name,
    description:
      category.data.seo.description ?? category.data.description ?? undefined,
    alternates: { canonical: `/category/${category.data.slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category.ok && category.error === "NOT_FOUND") notFound();
  if (!category.ok)
    return (
      <CatalogListing
        eyebrow="Category / FARTA"
        title="Danh mục"
        result={category}
        query={{ page: 1, limit: 24, sort: "newest" }}
        basePath={`/category/${slug}`}
      />
    );

  const query = parseCatalogQuery({
    ...(await searchParams),
    category: category.data.slug,
  });
  const products = await getProducts(query);
  return (
    <CatalogListing
      eyebrow="Category / FARTA"
      title={category.data.name}
      description={category.data.description}
      heroMedia={category.data.image}
      result={products}
      categories={[category.data]}
      query={query}
      basePath={`/category/${category.data.slug}`}
      filters
    />
  );
}
