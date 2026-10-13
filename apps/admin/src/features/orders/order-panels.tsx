import { BadgeCheck, Undo2 } from "lucide-react";

import { Button, Surface } from "@farta/ui";

import { Status } from "../../components/page";
import type { AdminOrderDetail } from "../../lib/api";
import { dateTime, formatVnd } from "./order-format";

export function ItemsPanel({ order }: { order: AdminOrderDetail }) {
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

export function TimelinePanel({ order }: { order: AdminOrderDetail }) {
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

export function AuditPanel({ order }: { order: AdminOrderDetail }) {
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

export function PaymentPanel({
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
          <Status value={payment.status} />
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
          {payment.status === "CONFLICT" && (
            <p className="state-card error" role="alert">
              Payment cần được đối soát trước khi tiếp tục fulfillment.
            </p>
          )}
          {["DEPOSIT_PAID", "FULLY_PAID", "CONFLICT"].includes(
            payment.status,
          ) && (
            <Button
              disabled={!reason.trim() || reconcile.isPending}
              onClick={() => reconcile.mutate("START_REFUND")}
              type="button"
            >
              <Undo2 aria-hidden="true" size={16} strokeWidth={1.7} />
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
                <BadgeCheck aria-hidden="true" size={16} strokeWidth={1.7} />
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
                <BadgeCheck aria-hidden="true" size={16} strokeWidth={1.7} />
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

export function ReservationPanel({ order }: { order: AdminOrderDetail }) {
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
