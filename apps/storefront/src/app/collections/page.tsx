import type { Metadata } from "next";
import Link from "next/link";

import { CatalogState } from "@/components/storefront/catalog-states";
import { MediaFrame } from "@/components/storefront/media-frame";
import { getCategories } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Bộ sưu tập",
  description: "Khám phá các câu chuyện sản phẩm đang hoạt động của FARTA.",
  alternates: { canonical: "/collections" },
};

export default async function CollectionsPage() {
  const categories = await getCategories();
  return (
    <main id="main-content" className="catalog-page">
      <header className="catalog-hero catalog-hero--collections">
        <p>Editorial index / FARTA</p>
        <h1>Bộ sưu tập</h1>
        <div>
          Mỗi nhóm sản phẩm là một nhịp điệu riêng. Collection domain độc lập sẽ
          được bổ sung khi backend có nguồn dữ liệu chính thức.
        </div>
      </header>
      <section className="collection-index" aria-label="Danh sách bộ sưu tập">
        {!categories.ok ? (
          <CatalogState
            kind="error"
            title="Không thể tải bộ sưu tập"
            detail="Category API đang tạm gián đoạn."
          />
        ) : categories.data.items.length === 0 ? (
          <CatalogState
            kind="empty"
            title="Chưa có bộ sưu tập đang hoạt động"
            detail="Các nhóm sản phẩm mới sẽ xuất hiện tại đây khi được phát hành."
          />
        ) : (
          categories.data.items.map((category, index) => (
            <Link
              className="collection-story"
              href={`/collections/${category.slug}`}
              key={category.id}
            >
              <div className="collection-story__media">
                <MediaFrame
                  media={category.image}
                  fallbackLabel={category.name}
                />
              </div>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h2>{category.name}</h2>
              <p>
                {category.description ?? "Khám phá các thiết kế trong nhóm."}
              </p>
            </Link>
          ))
        )}
      </section>
    </main>
  );
}
