import { useQuery } from "@tanstack/react-query";
import { Boxes } from "lucide-react";

import { Surface } from "@farta/ui";

import { Metric, PageHeader } from "../../components/page";
import { adminApi } from "../../lib/api";

export function DashboardPage() {
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: adminApi.categories,
  });
  const products = useQuery({
    queryKey: ["products"],
    queryFn: adminApi.products,
  });
  const media = useQuery({ queryKey: ["media"], queryFn: adminApi.media });
  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Tổng quan catalog"
        description="Một nguồn sự thật cho sản phẩm, tồn kho và nội dung storefront."
      />
      <section className="metric-grid">
        <Metric label="Danh mục" value={categories.data?.total} />
        <Metric label="Sản phẩm" value={products.data?.total} />
        <Metric label="Media assets" value={media.data?.items.length} />
      </section>
      <Surface className="notice">
        <Boxes />
        <div>
          <strong>Inventory ledger đang hoạt động</strong>
          <p>
            Mọi điều chỉnh tồn kho đi qua API có idempotency key và audit trail.
          </p>
        </div>
      </Surface>
    </>
  );
}
