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
          <h2>Mua sắm</h2>
          <Link href="/shop">Shop</Link>
          <Link href="/new-arrivals">Hàng mới</Link>
          <Link href="/collections">Bộ sưu tập</Link>
        </div>
        <div>
          <h2>Dịch vụ</h2>
          <Link href="/order-lookup">Tra cứu đơn hàng</Link>
          <Link href="/cart">Giỏ hàng</Link>
          <Link href="/account">Tài khoản</Link>
        </div>
        <div>
          <h2>FARTA</h2>
          <p>
            Phom dáng hiện đại dành cho nhịp sống Việt Nam — rõ ràng, tự do và
            không chạy theo tiếng ồn.
          </p>
        </div>
      </div>
      <div className="site-footer__base">
        <span>© 2026 FARTA</span>
        <span>Vietnam / VND</span>
      </div>
    </footer>
  );
}
