"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { ApiClientError } from "@/lib/api-client";
import { getPaymentStatus, initiatePayment } from "@/lib/checkout";
import { formatVnd } from "@/lib/catalog";

const terminalStatuses = new Set([
  "FULLY_PAID",
  "FAILED",
  "EXPIRED",
  "REFUND_PENDING",
  "REFUNDED",
  "CONFLICT",
]);

const pollingWindowMs = 5 * 60 * 1000;

export function PaymentPanel({ orderCode }: { orderCode: string }) {
  const queryClient = useQueryClient();
  const synchronizedStatus = useRef<string | null>(null);
  const [pollingStartedAt, setPollingStartedAt] = useState(() => Date.now());
  const [clock, setClock] = useState(() => Date.now());
  const payment = useQuery({
    queryKey: ["payment-status", orderCode],
    queryFn: () => getPaymentStatus(orderCode),
    retry: false,
    refetchInterval: (query) => {
      if (Date.now() - pollingStartedAt >= pollingWindowMs) return false;
      const status = query.state.data?.status;
      return status &&
        (terminalStatuses.has(status) ||
          (status !== "UNPAID" && status !== "DEPOSIT_PAID"))
        ? false
        : 3000;
    },
  });
  const paymentCanInitiate =
    payment.data?.status === "UNPAID" ||
    payment.data?.status === "DEPOSIT_PAID";
  const instructions = useQuery({
    queryKey: ["payment-instructions", orderCode],
    queryFn: () => initiatePayment(orderCode),
    enabled: paymentCanInitiate,
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const instructionExpiry = instructions.data?.instructions.expiresAt
    ? new Date(instructions.data.instructions.expiresAt).getTime()
    : null;
  useEffect(() => {
    const status = payment.data?.status;
    if (
      !status ||
      status === "UNPAID" ||
      synchronizedStatus.current === status
    ) {
      return;
    }
    synchronizedStatus.current = status;
    void queryClient.invalidateQueries({ queryKey: ["order", orderCode] });
  }, [orderCode, payment.data?.status, queryClient]);
  useEffect(() => {
    const futureDeadlines = [
      pollingStartedAt + pollingWindowMs,
      instructionExpiry,
    ].filter((value): value is number => value !== null && value > Date.now());
    if (futureDeadlines.length === 0) return;
    const nextDeadline = Math.min(...futureDeadlines);
    const timeout = window.setTimeout(
      () => setClock(Date.now()),
      nextDeadline - Date.now() + 25,
    );
    return () => window.clearTimeout(timeout);
  }, [instructionExpiry, pollingStartedAt]);

  if (payment.isPending) {
    return (
      <section className="payment-panel" aria-busy="true">
        <h2>Đang kiểm tra trạng thái thanh toán…</h2>
      </section>
    );
  }
  if (payment.isError || payment.isRefetchError) {
    return (
      <section className="payment-panel" role="status">
        <h2>Chưa kiểm tra được trạng thái</h2>
        <p>QR được tạm ẩn cho đến khi FARTA xác nhận trạng thái hiện tại.</p>
        <button
          className="button button--quiet"
          onClick={() => payment.refetch()}
          type="button"
        >
          Kiểm tra lại
        </button>
      </section>
    );
  }

  const currentStatus = payment.data.status;
  const pollingTimedOut =
    clock - pollingStartedAt >= pollingWindowMs &&
    !terminalStatuses.has(currentStatus);
  if (currentStatus === "FULLY_PAID") {
    return (
      <section className="payment-panel payment-panel--success" role="status">
        <p className="eyebrow">SePay verified</p>
        <h2>Thanh toán đã được xác nhận.</h2>
        <p>Trạng thái này đến từ webhook đã xác thực của máy chủ.</p>
      </section>
    );
  }
  if (currentStatus === "CONFLICT") {
    return (
      <section className="payment-panel payment-panel--conflict" role="alert">
        <h2>Thanh toán cần đối soát</h2>
        <p>
          FARTA đã nhận một sự kiện không khớp hoàn toàn. Không chuyển thêm
          tiền; đội vận hành sẽ kiểm tra giao dịch.
        </p>
      </section>
    );
  }
  if (currentStatus === "EXPIRED") {
    return (
      <section className="payment-panel" role="status">
        <h2>Phiên thanh toán đã hết hạn</h2>
        <p>Không chuyển tiền theo QR hoặc nội dung cũ.</p>
      </section>
    );
  }
  if (
    currentStatus === "FAILED" ||
    currentStatus === "REFUND_PENDING" ||
    currentStatus === "REFUNDED"
  ) {
    return (
      <section className="payment-panel" role="status">
        <h2>
          {currentStatus === "FAILED"
            ? "Thanh toán chưa thành công"
            : currentStatus === "REFUND_PENDING"
              ? "Thanh toán đang được xử lý hoàn tiền"
              : "Thanh toán đã được hoàn tiền"}
        </h2>
        <p>Không sử dụng lại QR cũ. Liên hệ FARTA nếu bạn đã chuyển tiền.</p>
      </section>
    );
  }
  if (currentStatus !== "UNPAID" && currentStatus !== "DEPOSIT_PAID") {
    return (
      <section className="payment-panel payment-panel--conflict" role="alert">
        <h2>Trạng thái thanh toán chưa được hỗ trợ</h2>
        <p>QR đã được ẩn. Không chuyển tiền và liên hệ FARTA để kiểm tra.</p>
      </section>
    );
  }
  if (instructions.isPending) {
    return (
      <section className="payment-panel" aria-busy="true">
        <h2>Đang tạo hướng dẫn SePay…</h2>
      </section>
    );
  }
  if (instructions.isError) {
    const expired =
      instructions.error instanceof ApiClientError &&
      instructions.error.payload.error.code === "PAYMENT_EXPIRED";
    return (
      <section className="payment-panel" role="status">
        <h2>{expired ? "Phiên thanh toán đã hết hạn" : "Chưa thể mở SePay"}</h2>
        <p>
          {expired
            ? "Không chuyển tiền theo mã cũ. FARTA cần kiểm tra lại tồn kho trước khi tạo hướng dẫn mới."
            : "Dịch vụ thanh toán đang gián đoạn. Bạn có thể thử lại an toàn."}
        </p>
        {!expired && (
          <button
            className="button button--quiet"
            onClick={() => instructions.refetch()}
            type="button"
          >
            Thử lại
          </button>
        )}
      </section>
    );
  }

  const needsRemainingPaymentInstructions =
    currentStatus === "DEPOSIT_PAID" &&
    instructions.data.status !== "DEPOSIT_PAID";
  const amount = payment.data.amountDue;
  const isExpired =
    Boolean(instructions.data.instructions.expiresAt) &&
    new Date(instructions.data.instructions.expiresAt).getTime() <= clock;
  if (needsRemainingPaymentInstructions) {
    return (
      <section className="payment-panel" role="status">
        <p className="eyebrow">Đã nhận tiền cọc</p>
        <h2>Cần tạo QR cho phần còn lại</h2>
        <p>
          QR trước đó chỉ dành cho khoản cọc. Cập nhật hướng dẫn trước khi
          chuyển thêm tiền.
        </p>
        <button
          className="button button--quiet"
          onClick={() => {
            const resumedAt = Date.now();
            setPollingStartedAt(resumedAt);
            setClock(resumedAt);
            void instructions.refetch();
          }}
          type="button"
        >
          Cập nhật QR phần còn lại
        </button>
      </section>
    );
  }
  if (isExpired) {
    return (
      <section className="payment-panel" role="status">
        <h2>Phiên thanh toán đã hết hạn</h2>
        <p>Không chuyển tiền theo QR hoặc nội dung cũ.</p>
      </section>
    );
  }
  if (pollingTimedOut) {
    return (
      <section className="payment-panel" role="status">
        <h2>Đã tạm dừng kiểm tra tự động</h2>
        <p>Kiểm tra lại trạng thái trước khi tiếp tục thanh toán.</p>
        <button
          className="button button--quiet"
          onClick={() => {
            const resumedAt = Date.now();
            setPollingStartedAt(resumedAt);
            setClock(resumedAt);
            void payment.refetch();
          }}
          type="button"
        >
          Kiểm tra và tiếp tục
        </button>
      </section>
    );
  }

  const info = instructions.data.instructions;
  return (
    <section className="payment-panel">
      <div>
        <p className="eyebrow">
          {currentStatus === "DEPOSIT_PAID"
            ? "Đã nhận cọc · Còn lại"
            : "Chờ SePay xác nhận"}
        </p>
        <h2>{formatVnd(amount)}</h2>
        <dl>
          <div>
            <dt>Ngân hàng</dt>
            <dd>{info.bank.name}</dd>
          </div>
          <div>
            <dt>Số tài khoản</dt>
            <dd>{info.bank.accountNumber}</dd>
          </div>
          <div>
            <dt>Chủ tài khoản</dt>
            <dd>{info.bank.accountHolder}</dd>
          </div>
          <div>
            <dt>Nội dung bắt buộc</dt>
            <dd>{info.reference}</dd>
          </div>
        </dl>
        <p>
          Chỉ trạng thái webhook của máy chủ mới xác nhận thanh toán. Trang này
          tự dừng kiểm tra sau 5 phút.
        </p>
        {currentStatus === "DEPOSIT_PAID" && (
          <button
            className="button button--quiet"
            onClick={() => {
              const resumedAt = Date.now();
              setPollingStartedAt(resumedAt);
              setClock(resumedAt);
              void instructions.refetch();
            }}
            type="button"
          >
            Cập nhật QR phần còn lại
          </button>
        )}
      </div>
      <Image
        alt={`QR thanh toán đơn ${orderCode}`}
        height={420}
        sizes="(max-width: 720px) 80vw, 360px"
        src={info.qrUrl}
        width={420}
      />
    </section>
  );
}
