import type { Metadata } from "next";

import { CheckoutPage } from "@/components/storefront/checkout-page";

export const metadata: Metadata = {
  title: "Thanh toán",
  description: "Xác nhận thông tin giao hàng và đặt đơn FARTA an toàn.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <CheckoutPage />;
}
