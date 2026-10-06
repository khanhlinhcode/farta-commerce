import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/storefront/auth-shell";

export const metadata: Metadata = {
  title: "Quên mật khẩu",
  robots: { index: false },
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Khôi phục tài khoản."
      detail="Password reset API chưa được cung cấp trong Phase 1 nên FARTA không mô phỏng việc gửi email."
    >
      <div className="honest-boundary">
        <p>
          Vui lòng liên hệ kênh hỗ trợ đã được stakeholder xác nhận. Chức năng
          này sẽ được kích hoạt sau khi backend có token một lần, thời hạn ngắn
          và lưu hash theo security architecture.
        </p>
        <Link className="button button--primary" href="/login">
          Trở về đăng nhập
        </Link>
      </div>
    </AuthShell>
  );
}
