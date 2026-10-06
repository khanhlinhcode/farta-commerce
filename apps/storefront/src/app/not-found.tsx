import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main-content" className="not-found-page">
      <p>404 / FARTA</p>
      <h1>Lạc khỏi đường runway.</h1>
      <div>
        Trang bạn tìm không tồn tại, đã ngừng hoạt động hoặc không còn được công
        khai.
      </div>
      <Link className="button button--primary" href="/shop">
        Trở lại cửa hàng
      </Link>
    </main>
  );
}
