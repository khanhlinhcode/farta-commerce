import type { Metadata } from "next";

import { AuthForm } from "@/components/storefront/auth-form";
import { AuthShell } from "@/components/storefront/auth-shell";

export const metadata: Metadata = {
  title: "Đăng nhập",
  robots: { index: false },
};

export default function LoginPage() {
  return (
    <AuthShell
      eyebrow="Customer access"
      title="Chào mừng trở lại."
      detail="Đăng nhập để quản lý hồ sơ và các phiên bảo mật của bạn."
    >
      <AuthForm mode="login" />
    </AuthShell>
  );
}
