import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Ban, CircleArrowRight } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Button, Surface } from "@farta/ui";

import { Status } from "../../components/page";
import { adminApi } from "../../lib/api";
import { errorMessage } from "../../lib/errors";
import { allowedOrderTransitions } from "./order-state";
import {
  AuditPanel,
  ItemsPanel,
  PaymentPanel,
  ReservationPanel,
  TimelinePanel,
} from "./order-panels";

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
  const allowed = allowedOrderTransitions(order.status);
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
                  <CircleArrowRight
                    aria-hidden="true"
                    size={16}
                    strokeWidth={1.7}
                  />
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
                <Ban aria-hidden="true" size={16} strokeWidth={1.7} />
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
