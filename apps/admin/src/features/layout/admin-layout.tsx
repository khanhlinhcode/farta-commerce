import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardList,
  ImageIcon,
  LayoutDashboard,
  LogOut,
  Megaphone,
  PackageSearch,
  Tags,
} from "lucide-react";
import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

import { adminApi, type AdminUser } from "../../lib/api";

const navigation = [
  ["/", "Tổng quan", LayoutDashboard],
  ["/categories", "Danh mục", Tags],
  ["/products", "Sản phẩm", PackageSearch],
  ["/orders", "Đơn hàng", ClipboardList],
  ["/media", "Media", ImageIcon],
  ["/banners", "Banner", Megaphone],
] as const;

export function AdminLayout({
  user,
  children,
}: {
  user: AdminUser;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const logout = useMutation({
    mutationFn: adminApi.logout,
    onSettled: () => queryClient.clear(),
  });
  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <div>
          <p className="wordmark">FARTA</p>
          <p className="eyebrow">Commerce operations</p>
        </div>
        <nav aria-label="Quản trị chính">
          {navigation.map(([to, label, Icon]) => (
            <NavLink end={to === "/"} key={to} to={to}>
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="staff-card">
          <strong>{user.displayName}</strong>
          <span>{user.roles.join(" · ")}</span>
          <button onClick={() => logout.mutate()} type="button">
            <LogOut size={16} /> Đăng xuất
          </button>
        </div>
      </aside>
      <main className="admin-content">{children}</main>
    </div>
  );
}
