import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { Button, Surface } from "@farta/ui";

import { adminApi, ApiFailure, type AdminOrderDetail } from "../../lib/api";

function formatVnd(value: number) {
  return `${new Intl.NumberFormat("vi-VN").format(value)} ₫`;
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function errorMessage(error: unknown) {
  return error instanceof ApiFailure
    ? error.message
    : "Không thể hoàn tất yêu cầu. Vui lòng thử lại.";
}

function Status({ value }: { value: string }) {
  return (
    <span className={`status status-${value.toLowerCase()}`}>{value}</span>
  );
}

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
      <header className="page-header">
        <p className="eyebrow">Order operations</p>
        <h1>Đơn hàng</h1>
        <p>Theo dõi fulfillment, payment và reconciliation từ dữ liệu thật.</p>
      </header>
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

const nextStatuses: Record<string, string[]> = {
  CREATED: ["CONFIRMED"],
  CONFIRMED: ["PACKING"],
  PACKING: ["SHIPPING"],
  SHIPPING: ["DELIVERED"],
  DELIVERED: ["COMPLETED"],
};

export function OrderDetailPage() {
  const { orderCode = "" } = useParams();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["admin-order", orderCode],
    queryFn: () => adminApi.order(orderCode),
    enabled: Boolean(orderCode),
  });
  const [reason, setReason] = useState("");
  const [nextStatus, setNextStatus] = useState("");
  const [refundReference, setRefundReference] = useState("");
  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["admin-order", orderCode],
    });
    await queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
  };
  const transition = useMutation({
    mutationFn: () => adminApi.transitionOrder(orderCode, nextStatus, reason),
    onSuccess: refresh,
  });
  const cancel = useMutation({
    mutationFn: () => adminApi.cancelOrder(orderCode, reason),
    onSuccess: refresh,
  });
  const reconcile = useMutation({
    mutationFn: (action: "START_REFUND" | "CONFIRM_REFUNDED") =>
      adminApi.reconcilePayment(orderCode, {
        action,
        reason,
        ...(refundReference ? { externalReference: refundReference } : {}),
      }),
    onSuccess: refresh,
  });
  const collectCod = useMutation({
    mutationFn: () => adminApi.collectCod(orderCode, reason),
    onSuccess: refresh,
  });
  if (query.isPending) return <p className="state-card">Đang tải đơn hàng…</p>;
  if (query.error || !query.data)
    return <p className="state-card error">{errorMessage(query.error)}</p>;
  const order = query.data;
  const allowed = nextStatuses[order.status] ?? [];
  const mutationError =
    transition.error ?? cancel.error ?? reconcile.error ?? collectCod.error;
  return (
    <>
      <Link className="back-link" to="/orders">
        <ArrowLeft size={16} /> Đơn hàng
      </Link>
      <header className="page-header order-title">
        <div>
          <p className="eyebrow">Order detail</p>
          <h1>{order.orderCode}</h1>
        </div>
        <div className="status-cluster">
          <Status value={order.status} />
          <Status value={order.paymentStatus} />
        </div>
      </header>
      <section className="order-detail-grid">
        <div className="order-main-stack">
          <ItemsPanel order={order} />
          <TimelinePanel order={order} />
          <AuditPanel order={order} />
        </div>
        <aside className="order-side-stack">
          <Surface className="panel">
            <h2>Vận hành</h2>
            <label>
              Lý do bắt buộc
              <textarea
                maxLength={500}
                onChange={(event) => setReason(event.target.value)}
                value={reason}
              />
            </label>
            {allowed.length > 0 && (
              <>
                <label>
                  Chuyển trạng thái
                  <select
                    onChange={(event) => setNextStatus(event.target.value)}
                    value={nextStatus}
                  >
                    <option value="">Chọn trạng thái</option>
                    {allowed.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </label>
                <Button
                  disabled={
                    !reason.trim() || !nextStatus || transition.isPending
                  }
                  onClick={() => transition.mutate()}
                  type="button"
                >
                  Cập nhật trạng thái
                </Button>
              </>
            )}
            {["CREATED", "CONFIRMED", "PAYMENT_CONFLICT"].includes(
              order.status,
            ) && (
              <Button
                className="danger-action"
                disabled={!reason.trim() || cancel.isPending}
                onClick={() => cancel.mutate()}
                type="button"
              >
                Huỷ đơn có kiểm soát
              </Button>
            )}
            {mutationError && (
              <p className="form-error" role="alert">
                {errorMessage(mutationError)}
              </p>
            )}
          </Surface>
          <PaymentPanel
            collectCod={collectCod}
            order={order}
            reason={reason}
            refundReference={refundReference}
            setRefundReference={setRefundReference}
            reconcile={reconcile}
          />
          <ReservationPanel order={order} />
        </aside>
      </section>
    </>
  );
}

function ItemsPanel({ order }: { order: AdminOrderDetail }) {
  return (
    <Surface className="panel table-panel">
      <h2>Sản phẩm</h2>
      <table>
        <thead>
          <tr>
            <th>Sản phẩm</th>
            <th>Variant</th>
            <th>SL</th>
            <th>Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.sku}>
              <td>
                {item.productName}
                <small>{item.sku}</small>
              </td>
              <td>
                {item.color} / {item.size}
              </td>
              <td>{item.quantity}</td>
              <td>{formatVnd(item.lineSubtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="price-summary">
        <div>
          <dt>Tạm tính</dt>
          <dd>{formatVnd(order.itemsSubtotal)}</dd>
        </div>
        <div>
          <dt>Vận chuyển</dt>
          <dd>{formatVnd(order.shippingFee)}</dd>
        </div>
        <div>
          <dt>Tổng</dt>
          <dd>{formatVnd(order.total)}</dd>
        </div>
      </dl>
    </Surface>
  );
}

function TimelinePanel({ order }: { order: AdminOrderDetail }) {
  return (
    <Surface className="panel">
      <h2>Timeline</h2>
      <ol className="ops-timeline">
        {order.timeline.map((entry, index) => (
          <li key={`${entry.status}-${entry.at}-${index}`}>
            <strong>{entry.status}</strong>
            <span>
              {dateTime(entry.at)} · {entry.actorType}
            </span>
          </li>
        ))}
      </ol>
    </Surface>
  );
}

function AuditPanel({ order }: { order: AdminOrderDetail }) {
  return (
    <Surface className="panel">
      <h2>Audit history</h2>
      {order.audit.length === 0 ? (
        <p className="state-card">Chưa có thao tác quản trị.</p>
      ) : (
        <ul className="audit-list">
          {order.audit.map((event) => (
            <li key={event.id}>
              <strong>{event.action}</strong>
              <span>{dateTime(event.createdAt)}</span>
              <p>{event.reason ?? "Không có lý do"}</p>
            </li>
          ))}
        </ul>
      )}
    </Surface>
  );
}

function PaymentPanel({
  collectCod,
  order,
  reason,
  refundReference,
  setRefundReference,
  reconcile,
}: {
  collectCod: { mutate: () => void; isPending: boolean };
  order: AdminOrderDetail;
  reason: string;
  refundReference: string;
  setRefundReference: (value: string) => void;
  reconcile: {
    mutate: (action: "START_REFUND" | "CONFIRM_REFUNDED") => void;
    isPending: boolean;
  };
}) {
  const payment = order.payment;
  return (
    <Surface className="panel">
      <h2>Payment</h2>
      {payment ? (
        <>
          <dl className="detail-list">
            <div>
              <dt>Provider</dt>
              <dd>{payment.provider}</dd>
            </div>
            <div>
              <dt>Method</dt>
              <dd>{payment.method}</dd>
            </div>
            <div>
              <dt>Expected</dt>
              <dd>{formatVnd(payment.expectedAmount)}</dd>
            </div>
            <div>
              <dt>Received</dt>
              <dd>{formatVnd(payment.receivedAmount)}</dd>
            </div>
            <div>
              <dt>Transaction</dt>
              <dd>{payment.transactionReference ?? "—"}</dd>
            </div>
          </dl>
          {["DEPOSIT_PAID", "FULLY_PAID", "CONFLICT"].includes(
            payment.status,
          ) && (
            <Button
              disabled={!reason.trim() || reconcile.isPending}
              onClick={() => reconcile.mutate("START_REFUND")}
              type="button"
            >
              Đánh dấu chờ hoàn tiền
            </Button>
          )}
          {payment.provider === "COD" &&
            payment.status === "UNPAID" &&
            ["DELIVERED", "COMPLETED"].includes(order.status) && (
              <Button
                disabled={!reason.trim() || collectCod.isPending}
                onClick={() => collectCod.mutate()}
                type="button"
              >
                Xác nhận đã thu COD
              </Button>
            )}
          {payment.status === "REFUND_PENDING" && (
            <>
              <label>
                Refund reference
                <input
                  maxLength={160}
                  onChange={(event) => setRefundReference(event.target.value)}
                  value={refundReference}
                />
              </label>
              <Button
                disabled={
                  !reason.trim() ||
                  !refundReference.trim() ||
                  reconcile.isPending
                }
                onClick={() => reconcile.mutate("CONFIRM_REFUNDED")}
                type="button"
              >
                Xác nhận đã hoàn tiền
              </Button>
            </>
          )}
        </>
      ) : (
        <p>Không có payment record.</p>
      )}
    </Surface>
  );
}

function ReservationPanel({ order }: { order: AdminOrderDetail }) {
  return (
    <Surface className="panel">
      <h2>Reservations</h2>
      <ul className="compact-list">
        {order.reservations.map((reservation) => (
          <li key={reservation.id}>
            <Status value={reservation.status} />
            <span>
              {reservation.quantity} × {reservation.variantId.slice(-8)}
            </span>
          </li>
        ))}
      </ul>
    </Surface>
  );
}
