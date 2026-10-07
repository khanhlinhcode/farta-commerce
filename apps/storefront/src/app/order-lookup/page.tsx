import type { Metadata } from "next";

import { OrderLookup } from "@/components/storefront/order-lookup";

export const metadata: Metadata = {
  title: "Tra cứu đơn hàng",
  description: "Tra cứu trạng thái đơn FARTA bằng mã đơn và số điện thoại.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <OrderLookup />;
}
