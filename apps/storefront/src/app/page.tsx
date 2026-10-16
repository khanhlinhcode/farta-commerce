import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { CampaignHeroMedia } from "@/components/storefront/campaign-hero-media";
import { CatalogState } from "@/components/storefront/catalog-states";
import { MediaFrame } from "@/components/storefront/media-frame";
import { ProductGrid } from "@/components/storefront/product-grid";
import {
  getBanners,
  getCategories,
  getProducts,
  type Banner,
} from "@/lib/catalog";

function Hero({ banner }: { banner: Banner | null }) {
  const developmentFallback =
    process.env.NODE_ENV === "development"
      ? "/images/farta-edit-01-hero.webp"
      : null;
  const title = banner?.title ?? "Chuyển động, được may đo.";
  const subtitle =
    banner?.subtitle ??
    "Những thiết kế dành cho người phụ nữ Việt hiện đại — tự do trong chuyển động, tinh tế trong từng chi tiết.";
  const ctaTarget = banner?.ctaTarget ?? "/shop";
  const ctaLabel = banner?.ctaLabel ?? "Khám phá bộ sưu tập";

  return (
    <section className="campaign-hero" aria-labelledby="home-hero-title">
      <CampaignHeroMedia
        name={title}
        desktopPoster={banner?.desktopMedia ?? null}
        mobilePoster={banner?.mobileMedia ?? null}
        desktopVideo={banner?.desktopVideo ?? null}
        mobileVideo={banner?.mobileVideo ?? null}
        developmentFallback={developmentFallback}
      />
      <div className="campaign-hero__veil" aria-hidden="true" />
      <div className="campaign-hero__copy">
        <h1 id="home-hero-title">{title}</h1>
        <p>{subtitle}</p>
        <Link className="editorial-link" href={ctaTarget}>
          {ctaLabel}
          <ArrowRight aria-hidden="true" size={17} strokeWidth={1.5} />
        </Link>
      </div>
      <p className="campaign-hero__signature" aria-hidden="true">
        FARTA
      </p>
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
  const featuredCategory = categories[0] ?? null;
  const categoryCards = categories.slice(featuredCategory ? 1 : 0, 4);

  return (
    <main id="main-content">
      <Hero banner={banner} />

      <section
        className="home-section home-arrivals home-section--catalog"
        aria-labelledby="new-arrivals-title"
      >
        <div className="home-section__heading home-section__heading--catalog">
          <div>
            <h2 id="new-arrivals-title">Hàng mới</h2>
            <p>
              Những phom dáng vừa xuất hiện trong catalog FARTA, được trình bày
              đúng theo màu sắc và tình trạng hiện có.
            </p>
          </div>
          <Link href="/new-arrivals">
            Xem tất cả
            <ArrowRight aria-hidden="true" size={16} strokeWidth={1.5} />
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

      {featuredCategory && (
        <section
          className="home-feature"
          aria-labelledby="featured-collection-title"
        >
          <div className="home-feature__media">
            <MediaFrame
              fallbackLabel={featuredCategory.name}
              media={featuredCategory.image}
              sizes="(max-width: 900px) calc(100vw - 32px), 62vw"
            />
          </div>
          <div className="home-feature__copy">
            <h2 id="featured-collection-title">{featuredCategory.name}</h2>
            <p>
              {featuredCategory.description ??
                "Khám phá những thiết kế đang hiện diện trong danh mục FARTA."}
            </p>
            <Link
              className="editorial-link"
              href={`/category/${featuredCategory.slug}`}
            >
              Xem tuyển chọn
              <ArrowRight aria-hidden="true" size={17} strokeWidth={1.5} />
            </Link>
          </div>
        </section>
      )}

      <section
        className="home-section home-categories home-section--editorial"
        aria-labelledby="collections-title"
      >
        <div className="home-section__heading home-section__heading--editorial">
          <h2 id="collections-title">Phom dáng cho từng nhịp sống</h2>
          <p>Đi từ danh mục thực tế, không từ những xu hướng được dựng sẵn.</p>
        </div>
        {categoryCards.length > 0 ? (
          <div className="category-grid">
            {categoryCards.map((category) => (
              <Link
                className="category-card"
                href={`/category/${category.slug}`}
                key={category.id}
              >
                <div className="category-card__media">
                  <MediaFrame
                    fallbackLabel={category.name}
                    media={category.image}
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  />
                </div>
                <div>
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
        <h2 id="brand-note-title">
          Trang phục theo nhịp sống, không chạy theo tiếng ồn.
        </h2>
        <p>
          FARTA đặt phom dáng, chuyển động và trải nghiệm mặc ở trung tâm của
          từng lựa chọn.
        </p>
        <Link className="editorial-link editorial-link--light" href="/shop">
          Xem toàn bộ thiết kế
          <ArrowRight aria-hidden="true" size={17} strokeWidth={1.5} />
        </Link>
      </section>
    </main>
  );
}
