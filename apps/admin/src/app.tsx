import { useQuery } from "@tanstack/react-query";
import { Navigate, Route, Routes } from "react-router-dom";

import { PermissionDeniedState } from "./components/page";
import { LoginPage } from "./features/auth/login-page";
import { BannersPage } from "./features/banners/banners-page";
import { CategoriesPage } from "./features/categories/categories-page";
import { DashboardPage } from "./features/dashboard/dashboard-page";
import { AdminLayout } from "./features/layout/admin-layout";
import { MediaPage } from "./features/media/media-page";
import { OrderDetailPage } from "./features/orders/order-detail-page";
import { OrdersPage } from "./features/orders/orders-page";
import { ProductsPage } from "./features/products/products-page";
import { ProductDetailPage } from "./features/variants/product-detail-page";
import { adminApi, ApiFailure } from "./lib/api";

function ProtectedApp() {
  const me = useQuery({
    queryKey: ["staff-me"],
    queryFn: adminApi.me,
    retry: false,
  });
  if (me.isPending)
    return (
      <main className="center-state" role="status">
        Đang kiểm tra phiên quản trị…
      </main>
    );
  if (me.error instanceof ApiFailure && me.error.status === 403)
    return <PermissionDeniedState />;
  if (me.error || !me.data) return <Navigate replace to="/login" />;
  return (
    <AdminLayout user={me.data.user}>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/products/:productId" element={<ProductDetailPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/orders/:orderCode" element={<OrderDetailPage />} />
        <Route path="/media" element={<MediaPage />} />
        <Route path="/banners" element={<BannersPage />} />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    </AdminLayout>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*" element={<ProtectedApp />} />
    </Routes>
  );
}
