import type { Metadata } from "next";

import { CartPage } from "@/components/storefront/cart-page";

export const metadata: Metadata = {
  title: "Giỏ hàng",
  description: "Kiểm tra những lựa chọn FARTA trước khi thanh toán.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <CartPage />;
}
