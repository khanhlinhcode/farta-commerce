import type { Metadata } from "next";

import { AuthForm } from "@/components/storefront/auth-form";
import { AuthShell } from "@/components/storefront/auth-shell";

export const metadata: Metadata = {
  title: "Đăng ký",
  robots: { index: false },
};

export default function RegisterPage() {
  return (
    <AuthShell
      eyebrow="Join FARTA"
      title="Tạo tài khoản."
      detail="Một tài khoản thật, được bảo vệ bởi Phase 1 authentication và server-side session."
    >
      <AuthForm mode="register" />
    </AuthShell>
  );
}
