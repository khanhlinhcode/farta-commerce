"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { ApiClientError } from "@/lib/api-client";
import { getCustomerOrders } from "@/lib/checkout";
import { formatVnd } from "@/lib/catalog";

export function AccountOrders() {
  const orders = useQuery({
    queryKey: ["customer-orders"],
    queryFn: getCustomerOrders,
    retry: false,
  });
  if (orders.isPending)
    return (
      <div className="account-state" aria-busy="true">
        Đang tải đơn hàng…
      </div>
    );
  if (orders.isError)
    return (
      <div className="account-state">
        {orders.error instanceof ApiClientError &&
        (orders.error.status === 401 || orders.error.status === 403) ? (
          <>
            <h2>Đăng nhập để xem đơn hàng</h2>
            <p>FARTA chỉ hiển thị đơn thuộc tài khoản đã xác thực.</p>
            <Link className="button button--primary" href="/login">
              Đăng nhập
            </Link>
          </>
        ) : (
          <>
            <h2>Chưa thể tải đơn hàng</h2>
            <p>Kết nối đang gián đoạn. Vui lòng thử lại sau.</p>
            <button
              className="button button--quiet"
              onClick={() => orders.refetch()}
              type="button"
            >
              Thử lại
            </button>
          </>
        )}
      </div>
    );
  if (!orders.data.items.length)
    return (
      <div className="account-state">
        <h2>Chưa có đơn hàng</h2>
        <p>Khi bạn đặt hàng, lịch sử thật sẽ xuất hiện tại đây.</p>
        <Link href="/shop">Khám phá sản phẩm</Link>
      </div>
    );
  return (
    <div>
      <h2>Đơn hàng</h2>
      <div className="account-order-list">
        {orders.data.items.map((order) => (
          <Link href={`/account/orders/${order.orderCode}`} key={order.id}>
            <div>
              <strong>{order.orderCode}</strong>
              <span>{order.status}</span>
            </div>
            <div>
              <time>
                {new Intl.DateTimeFormat("vi-VN", {
                  dateStyle: "medium",
                }).format(new Date(order.createdAt))}
              </time>
              <strong>{formatVnd(order.total)}</strong>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
