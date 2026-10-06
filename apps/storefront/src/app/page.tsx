import Image from "next/image";
import Link from "next/link";

import { CatalogState } from "@/components/storefront/catalog-states";
import { MediaFrame } from "@/components/storefront/media-frame";
import { ProductGrid } from "@/components/storefront/product-grid";
import {
  canOptimizeCloudinary,
  getBanners,
  getCategories,
  getProducts,
  type Banner,
} from "@/lib/catalog";

function Hero({ banner }: { banner: Banner | null }) {
  const remoteImage = banner?.desktopMedia?.secureUrl;
  const developmentFallback =
    process.env.NODE_ENV === "development"
      ? "/images/farta-edit-01-hero.webp"
      : null;
  const imageSource =
    remoteImage && canOptimizeCloudinary(remoteImage)
      ? remoteImage
      : developmentFallback;
  const title = banner?.title ?? "Chuyển động, được may đo.";
  const subtitle =
    banner?.subtitle ??
    "Những thiết kế dành cho người phụ nữ Việt hiện đại — tự do trong chuyển động, tinh tế trong từng chi tiết.";
  const ctaTarget = banner?.ctaTarget ?? "/shop";
  const ctaLabel = banner?.ctaLabel ?? "Khám phá bộ sưu tập";

  return (
    <section className="runway-hero" aria-labelledby="home-hero-title">
      <div className="runway-hero__copy">
        <p className="runway-season">FARTA / 2026 — EDIT 01</p>
        <ol className="runway-index" aria-label="Chỉ mục biên tập">
          <li className="is-active">01</li>
          <li>02</li>
          <li>03</li>
          <li>04</li>
        </ol>
        <h1 id="home-hero-title">{title}</h1>
        <p className="runway-hero__lede">{subtitle}</p>
        <Link className="editorial-link" href={ctaTarget}>
          {ctaLabel} <span aria-hidden="true">⟶</span>
        </Link>
      </div>
      <div className={`runway-hero__media${imageSource ? "" : " is-empty"}`}>
        {imageSource ? (
          <Image
            alt={
              banner?.desktopMedia?.altText ??
              "FARTA Edit 01 — chuyển động và phom dáng"
            }
            fill
            priority
            sizes="(max-width: 767px) 100vw, 60vw"
            src={imageSource}
          />
        ) : (
          <div className="runway-hero__fallback" aria-hidden="true">
            <span>FARTA</span>
            <span>EDIT 01</span>
          </div>
        )}
      </div>
    </section>
  );
}

export default async function HomePage() {
  const [bannerResult, productResult, categoryResult] = await Promise.all([
    getBanners(),
    getProducts({ limit: 4, sort: "newest" }),
    getCategories(),
  ]);

  const banner = bannerResult.ok ? (bannerResult.data.items[0] ?? null) : null;
  const products = productResult.ok ? productResult.data.items : [];
  const categories = categoryResult.ok ? categoryResult.data.items : [];

  return (
    <main id="main-content">
      <Hero banner={banner} />

      <section
        className="home-section home-arrivals"
        aria-labelledby="new-arrivals-title"
      >
        <div className="section-heading">
          <h2 id="new-arrivals-title">Hàng mới</h2>
          <Link href="/new-arrivals">
            Xem tất cả <span aria-hidden="true">⟶</span>
          </Link>
        </div>
        {productResult.ok && products.length > 0 ? (
          <ProductGrid products={products} />
        ) : (
          <CatalogState
            kind={productResult.ok ? "empty" : "error"}
            title={
              productResult.ok
                ? "Bộ sưu tập mới đang được chuẩn bị"
                : "Chưa thể tải hàng mới"
            }
            detail={
              productResult.ok
                ? "Các thiết kế đã xuất bản sẽ xuất hiện tại đây."
                : "Catalog đang tạm gián đoạn. Bạn có thể thử lại sau."
            }
          />
        )}
      </section>

      <section
        className="home-section home-categories"
        aria-labelledby="collections-title"
      >
        <div className="section-heading section-heading--editorial">
          <h2 id="collections-title">Bộ sưu tập</h2>
          <p>
            Những câu chuyện về phong cách, chất liệu và phụ nữ Việt đương đại.
          </p>
        </div>
        {categories.length > 0 ? (
          <div className="category-grid">
            {categories.slice(0, 3).map((category, index) => (
              <Link
                className="category-card"
                href={`/category/${category.slug}`}
                key={category.id}
              >
                <div className="category-card__media">
                  <MediaFrame
                    fallbackLabel={category.name}
                    media={category.image}
                    priority={index === 0}
                  />
                </div>
                <div>
                  <span>0{index + 1}</span>
                  <h3>{category.name}</h3>
                  {category.description ? <p>{category.description}</p> : null}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <CatalogState
            kind={categoryResult.ok ? "empty" : "error"}
            title={
              categoryResult.ok
                ? "Chưa có bộ sưu tập công khai"
                : "Không thể tải danh mục"
            }
            detail="FARTA chỉ hiển thị danh mục ACTIVE từ hệ thống quản trị."
          />
        )}
      </section>

      <section className="brand-note" aria-labelledby="brand-note-title">
        <p>FARTA / VIETNAM</p>
        <h2 id="brand-note-title">
          Trang phục theo nhịp sống, không chạy theo tiếng ồn.
        </h2>
        <Link className="editorial-link editorial-link--light" href="/shop">
          Xem toàn bộ thiết kế <span aria-hidden="true">⟶</span>
        </Link>
      </section>
    </main>
  );
}
