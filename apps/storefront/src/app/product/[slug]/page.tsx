import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CatalogState } from "@/components/storefront/catalog-states";
import { ProductGallery } from "@/components/storefront/product-gallery";
import { ProductGrid } from "@/components/storefront/product-grid";
import { VariantSelector } from "@/components/storefront/variant-selector";
import { getProduct, getProducts } from "@/lib/catalog";

type Props = { params: Promise<{ slug: string }> };

function safeImage(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product.ok) return { title: "Sản phẩm" };
  const image = safeImage(product.data.coverMedia?.secureUrl);
  const title = product.data.seo.title ?? product.data.name;
  const description =
    product.data.seo.description ??
    product.data.shortDescription ??
    product.data.description ??
    undefined;
  return {
    title,
    description,
    alternates: { canonical: `/product/${product.data.slug}` },
    openGraph: {
      type: "website",
      title,
      description,
      images: image ? [{ url: image, alt: product.data.name }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product.ok && product.error === "NOT_FOUND") notFound();
  if (!product.ok)
    return (
      <main id="main-content" className="catalog-page">
        <CatalogState
          kind="error"
          title="Không thể tải sản phẩm"
          detail="FARTA Catalog API đang tạm gián đoạn. Vui lòng thử lại sau."
        />
      </main>
    );

  const item = product.data;
  const gallery = [item.coverMedia, ...item.media].filter(
    (media, index, all) =>
      media &&
      all.findIndex((candidate) => candidate?.id === media.id) === index,
  );
  const related = item.categoryIds[0]
    ? await getProducts({
        category: item.categoryIds[0],
        limit: 5,
        sort: "newest",
      })
    : null;
  const relatedItems = related?.ok
    ? related.data.items
        .filter((candidate) => candidate.id !== item.id)
        .slice(0, 4)
    : [];
  const productUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/product/${item.slug}`;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: item.name,
    description: item.description ?? item.shortDescription ?? undefined,
    image: gallery
      .map((media) => safeImage(media?.secureUrl))
      .filter((url): url is string => Boolean(url)),
    url: productUrl,
    offers: item.variants.map((variant) => ({
      "@type": "Offer",
      sku: variant.sku,
      priceCurrency: variant.currency,
      price: variant.price,
      availability: `https://schema.org/${
        variant.availability === "OUT_OF_STOCK" ? "OutOfStock" : "InStock"
      }`,
      url: productUrl,
    })),
  };

  return (
    <main id="main-content" className="product-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/shop">Shop</Link>
        <span aria-hidden="true">/</span>
        <span>{item.name}</span>
      </nav>
      <div className="product-detail">
        <ProductGallery
          name={item.name}
          media={gallery.flatMap((media) => (media ? [media] : []))}
        />
        <section className="product-detail__info">
          <p className="eyebrow">
            FARTA / {item.tags[0] ?? "Current collection"}
          </p>
          <h1>{item.name}</h1>
          {item.shortDescription && (
            <p className="product-lede">{item.shortDescription}</p>
          )}
          <VariantSelector variants={item.variants} />
          <div className="product-accordions">
            <details open>
              <summary>Mô tả</summary>
              <p>{item.description ?? "Thông tin mô tả đang được cập nhật."}</p>
            </details>
            <details>
              <summary>Kích cỡ & chăm sóc</summary>
              <p>
                Size guide cá nhân hóa chưa có nguồn dữ liệu chính thức. Hãy đối
                chiếu số đo sản phẩm trước khi mua; hướng dẫn chất liệu sẽ chỉ
                hiển thị khi Catalog API cung cấp.
              </p>
            </details>
            <details>
              <summary>Giao hàng & đổi trả</summary>
              <p>
                Chính sách giao hàng và đổi trả chi tiết sẽ hiển thị sau khi
                stakeholder phê duyệt nội dung vận hành chính thức.
              </p>
            </details>
          </div>
        </section>
      </div>
      {relatedItems.length > 0 && (
        <section className="related-products">
          <div className="section-heading">
            <h2>Cùng danh mục</h2>
          </div>
          <ProductGrid products={relatedItems} />
        </section>
      )}
    </main>
  );
}
