import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Tài khoản",
  robots: { index: false, follow: false },
};

const links = [
  ["/account", "Tổng quan"],
  ["/account/profile", "Hồ sơ"],
  ["/account/orders", "Đơn hàng"],
  ["/account/security", "Bảo mật"],
] as const;

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <main id="main-content" className="account-page">
      <header>
        <p className="eyebrow">Private / Customer</p>
        <h1>Tài khoản</h1>
      </header>
      <div className="account-layout">
        <nav aria-label="Điều hướng tài khoản">
          {links.map(([href, label]) => (
            <Link key={href} href={href}>
              {label}
            </Link>
          ))}
        </nav>
        <section className="account-content">{children}</section>
      </div>
    </main>
  );
}
