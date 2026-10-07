"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  GuestOrderLookupReadModel,
  OrderReadModel,
  OrderStatus,
} from "@farta/types";
import Link from "next/link";

import { ApiClientError } from "@/lib/api-client";
import { getOrder } from "@/lib/checkout";
import { formatVnd } from "@/lib/catalog";
import { MediaFrame } from "./media-frame";

const labels: Record<OrderStatus, string> = {
  CREATED: "Đã đặt hàng",
  CONFIRMED: "Đã xác nhận",
  PACKING: "Đang chuẩn bị",
  SHIPPING: "Đang giao",
  DELIVERED: "Đã giao",
  COMPLETED: "Hoàn tất",
  CANCELLED: "Đã hủy",
  PAYMENT_CONFLICT: "Cần đối soát thanh toán",
};

export function OrderDetail({ orderCode }: { orderCode: string }) {
  const order = useQuery({
    queryKey: ["order", orderCode],
    queryFn: () => getOrder(orderCode),
    retry: false,
  });
  if (order.isPending)
    return (
      <div className="order-state" aria-busy="true">
        Đang tải đơn hàng…
      </div>
    );
  if (order.isError)
    return (
      <div className="order-state">
        <h1>Không thể mở đơn hàng</h1>
        {order.error instanceof ApiClientError &&
        [401, 403, 404].includes(order.error.status) ? (
          <>
            <p>
              Đăng nhập đúng tài khoản hoặc dùng tra cứu đơn hàng với số điện
              thoại người nhận.
            </p>
            <Link className="button button--primary" href="/order-lookup">
              Tra cứu đơn hàng
            </Link>
          </>
        ) : (
          <>
            <p>Kết nối đang gián đoạn. Vui lòng thử lại sau.</p>
            <button
              className="button button--quiet"
              onClick={() => order.refetch()}
              type="button"
            >
              Thử lại
            </button>
          </>
        )}
      </div>
    );
  return <OrderDetailView order={order.data} />;
}

export function OrderDetailView({
  order,
}: {
  order: OrderReadModel | GuestOrderLookupReadModel;
}) {
  return (
    <div className="order-detail">
      <header>
        <p className="eyebrow">Đơn hàng {order.orderCode}</p>
        <h1>{labels[order.status]}</h1>
        <p>
          Đặt lúc{" "}
          {new Intl.DateTimeFormat("vi-VN", {
            dateStyle: "long",
            timeStyle: "short",
          }).format(new Date(order.createdAt))}
        </p>
      </header>
      <div className="order-detail-layout">
        <section>
          <h2>Sản phẩm</h2>
          <div className="order-items">
            {order.items.map((item, index) => (
              <article key={`${item.productName}-${item.color}-${item.size}`}>
                <div className="order-item-media">
                  <MediaFrame
                    media={
                      item.image
                        ? { id: `${order.orderCode}-${index}`, ...item.image }
                        : null
                    }
                    fallbackLabel={item.productName}
                  />
                </div>
                <div>
                  <strong>{item.productName}</strong>
                  <p>
                    {item.color} · {item.size} · SL {item.quantity}
                  </p>
                </div>
                <span>{formatVnd(item.lineSubtotal)}</span>
              </article>
            ))}
          </div>
          <h2>Tiến trình</h2>
          <ol className="order-timeline">
            {order.timeline.map((entry) => (
              <li key={`${entry.status}-${entry.at}`}>
                <span aria-hidden="true" />
                <div>
                  <strong>{labels[entry.status]}</strong>
                  <time>
                    {new Intl.DateTimeFormat("vi-VN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(entry.at))}
                  </time>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <aside>
          {"shipping" in order ? (
            <>
              <h2>Giao nhận</h2>
              <p>
                <strong>{order.shipping.recipientName}</strong>
                <br />
                {order.shipping.phone}
                <br />
                {order.shipping.addressLine}
                <br />
                {[
                  order.shipping.ward,
                  order.shipping.district,
                  order.shipping.provinceCity,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            </>
          ) : (
            <>
              <h2>Thông tin được bảo vệ</h2>
              <p>
                Địa chỉ và số điện thoại được ẩn trong kết quả tra cứu công
                khai.
              </p>
            </>
          )}
          <h2>Thanh toán</h2>
          <p>
            COD ·{" "}
            {order.paymentStatus === "UNPAID"
              ? "Chưa thu tiền"
              : order.paymentStatus}
          </p>
          <dl className="price-summary">
            <div>
              <dt>Tạm tính</dt>
              <dd>{formatVnd(order.itemsSubtotal)}</dd>
            </div>
            <div>
              <dt>Vận chuyển</dt>
              <dd>{formatVnd(order.shippingFee)}</dd>
            </div>
            <div className="price-summary__total">
              <dt>Tổng</dt>
              <dd>{formatVnd(order.total)}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
}
