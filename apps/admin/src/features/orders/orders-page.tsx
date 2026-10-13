import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import { Button, Surface } from "@farta/ui";

import { PageHeader, Status } from "../../components/page";
import { adminApi } from "../../lib/api";
import { errorMessage } from "../../lib/errors";
import { dateTime, formatVnd } from "./order-format";

export function OrdersPage() {
  const [parameters, setParameters] = useSearchParams();
  const page = Math.max(1, Number(parameters.get("page") ?? "1") || 1);
  const query = useQuery({
    queryKey: ["admin-orders", parameters.toString()],
    queryFn: () => adminApi.orders(parameters.toString()),
  });
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(parameters);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.set("page", "1");
    setParameters(next);
  };
  return (
    <>
      <PageHeader
        eyebrow="Order operations"
        title="Đơn hàng"
        description="Theo dõi fulfillment, payment và reconciliation từ dữ liệu thật."
      />
      <Surface className="panel order-filters">
        <label>
          Tìm order code / số điện thoại
          <input
            defaultValue={parameters.get("q") ?? ""}
            maxLength={64}
            onBlur={(event) => update("q", event.target.value.trim())}
            placeholder="FAR-… hoặc +84…"
          />
        </label>
        <label>
          Order status
          <select
            onChange={(event) => update("status", event.target.value)}
            value={parameters.get("status") ?? ""}
          >
            <option value="">Tất cả</option>
            {[
              "CREATED",
              "CONFIRMED",
              "PACKING",
              "SHIPPING",
              "DELIVERED",
              "COMPLETED",
              "CANCELLED",
              "PAYMENT_CONFLICT",
            ].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Payment status
          <select
            onChange={(event) => update("paymentStatus", event.target.value)}
            value={parameters.get("paymentStatus") ?? ""}
          >
            <option value="">Tất cả</option>
            {[
              "UNPAID",
              "DEPOSIT_PAID",
              "FULLY_PAID",
              "REFUND_PENDING",
              "REFUNDED",
              "CONFLICT",
            ].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
      </Surface>
      {query.isPending && <p className="state-card">Đang tải đơn hàng…</p>}
      {query.error && (
        <p className="state-card error" role="alert">
          {errorMessage(query.error)}
        </p>
      )}
      {query.data && (
        <Surface className="panel table-panel">
          <div className="table-summary">
            <strong>{query.data.total} đơn hàng</strong>
            <span>
              Trang {query.data.page}/{Math.max(1, query.data.pages)}
            </span>
          </div>
          {query.data.items.length === 0 ? (
            <p className="state-card">Không có đơn hàng khớp bộ lọc.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Đơn hàng</th>
                  <th>Khách nhận</th>
                  <th>Fulfillment</th>
                  <th>Payment</th>
                  <th>Tổng</th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link
                        className="text-link"
                        to={`/orders/${order.orderCode}`}
                      >
                        {order.orderCode}
                      </Link>
                      <small>{dateTime(order.createdAt)}</small>
                    </td>
                    <td>
                      {order.recipientName}
                      <small>{order.phone}</small>
                    </td>
                    <td>
                      <Status value={order.status} />
                    </td>
                    <td>
                      <Status value={order.paymentStatus} />
                    </td>
                    <td>{formatVnd(order.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="pagination-actions">
            <Button
              disabled={page <= 1}
              onClick={() => update("page", String(page - 1))}
              type="button"
            >
              <ChevronLeft size={16} /> Trước
            </Button>
            <Button
              disabled={page >= query.data.pages}
              onClick={() => update("page", String(page + 1))}
              type="button"
            >
              Sau <ChevronRight size={16} />
            </Button>
          </div>
        </Surface>
      )}
    </>
  );
}
