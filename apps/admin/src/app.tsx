import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { PermissionDeniedState } from "./components/page";
import { LoginPage } from "./features/auth/login-page";
import { AdminLayout } from "./features/layout/admin-layout";
import { adminApi, ApiFailure } from "./lib/api";
import { StaffProvider } from "./lib/staff-context";

const DashboardPage = lazy(() =>
  import("./features/dashboard/dashboard-page").then((module) => ({
    default: module.DashboardPage,
  })),
);
const CategoriesPage = lazy(() =>
  import("./features/categories/categories-page").then((module) => ({
    default: module.CategoriesPage,
  })),
);
const ProductsPage = lazy(() =>
  import("./features/products/products-page").then((module) => ({
    default: module.ProductsPage,
  })),
);
const ProductDetailPage = lazy(() =>
  import("./features/variants/product-detail-page").then((module) => ({
    default: module.ProductDetailPage,
  })),
);
const MediaPage = lazy(() =>
  import("./features/media/media-page").then((module) => ({
    default: module.MediaPage,
  })),
);
const BannersPage = lazy(() =>
  import("./features/banners/banners-page").then((module) => ({
    default: module.BannersPage,
  })),
);
const OrdersPage = lazy(() =>
  import("./features/orders/orders-page").then((module) => ({
    default: module.OrdersPage,
  })),
);
const OrderDetailPage = lazy(() =>
  import("./features/orders/order-detail-page").then((module) => ({
    default: module.OrderDetailPage,
  })),
);

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
    <StaffProvider user={me.data.user}>
      <AdminLayout user={me.data.user}>
        <Suspense fallback={<main className="center-state">Đang tải…</main>}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route
              path="/products/:productId"
              element={<ProductDetailPage />}
            />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/orders/:orderCode" element={<OrderDetailPage />} />
            <Route path="/media" element={<MediaPage />} />
            <Route path="/banners" element={<BannersPage />} />
            <Route path="*" element={<Navigate replace to="/" />} />
          </Routes>
        </Suspense>
      </AdminLayout>
    </StaffProvider>
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
