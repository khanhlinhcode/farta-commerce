import type { Metadata } from "next";
import { Be_Vietnam_Pro, Cormorant_Garamond } from "next/font/google";
import type { ReactNode } from "react";

import { Providers } from "@/components/providers";
import { SiteFooter } from "@/components/storefront/site-footer";
import { SiteHeader } from "@/components/storefront/site-header";

import "./globals.css";

const display = Cormorant_Garamond({
  subsets: ["vietnamese"],
  weight: ["400", "500", "600"],
  variable: "--font-farta-display",
  display: "swap",
});

const body = Be_Vietnam_Pro({
  subsets: ["vietnamese"],
  weight: ["400", "500", "600"],
  variable: "--font-farta-body",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "FARTA — Thời trang trong chuyển động",
    template: "%s — FARTA",
  },
  description:
    "Thời trang FARTA với phom dáng hiện đại, chất liệu được tuyển chọn và trải nghiệm mua sắm rõ ràng.",
  openGraph: {
    type: "website",
    locale: "vi_VN",
    siteName: "FARTA",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="vi"
      className={`${display.variable} ${body.variable}`}
      data-scroll-behavior="smooth"
    >
      <body>
        <Providers>
          <a className="skip-link" href="#main-content">
            Bỏ qua đến nội dung
          </a>
          <SiteHeader />
          {children}
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
