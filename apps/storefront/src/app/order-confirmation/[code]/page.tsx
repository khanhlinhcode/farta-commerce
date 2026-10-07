import type { Metadata } from "next";

import { OrderDetail } from "@/components/storefront/order-detail";

export const metadata: Metadata = {
  title: "Xác nhận đơn hàng",
  robots: { index: false, follow: false },
};

export default async function Page({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return (
    <main id="main-content" className="order-page">
      <OrderDetail orderCode={code} />
    </main>
  );
}
