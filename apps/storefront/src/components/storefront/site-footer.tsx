import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__lead">
        <p className="wordmark">FARTA</p>
        <p>Thời trang hiện đại, được nhìn qua nhịp sống Việt Nam.</p>
      </div>
      <div className="footer-links">
        <div>
          <h2>Khám phá</h2>
          <Link href="/shop">Shop</Link>
          <Link href="/new-arrivals">Hàng mới</Link>
          <Link href="/collections">Bộ sưu tập</Link>
        </div>
        <div>
          <h2>Hỗ trợ</h2>
          <Link href="/account">Tài khoản</Link>
          <Link href="/account/orders">Đơn hàng</Link>
          <span>Chính sách — chờ cấu hình</span>
        </div>
        <div>
          <h2>FARTA</h2>
          <span>Instagram — chờ cấu hình</span>
          <span>TikTok — chờ cấu hình</span>
          <span>Liên hệ — chờ cấu hình</span>
        </div>
      </div>
      <div className="site-footer__base">
        <span>© 2026 FARTA</span>
        <span>Vietnam / VND</span>
      </div>
    </footer>
  );
}
