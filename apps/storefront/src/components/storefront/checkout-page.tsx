"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cloneElement, useRef, useState, type ReactElement } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { ApiClientError } from "@/lib/api-client";
import { cartQueryKey } from "@/lib/cart";
import { getCheckoutPreview, submitCheckout } from "@/lib/checkout";
import { formatVnd } from "@/lib/catalog";
import { MediaFrame } from "./media-frame";

const checkoutSchema = z.object({
  recipientName: z.string().trim().min(1, "Nhập tên người nhận.").max(100),
  phone: z.string().trim().min(9, "Số điện thoại chưa hợp lệ.").max(30),
  addressLine: z.string().trim().min(5, "Nhập địa chỉ giao hàng.").max(300),
  provinceCity: z.string().trim().min(1, "Nhập tỉnh/thành phố.").max(120),
  district: z.string().trim().max(120),
  ward: z.string().trim().max(120),
  notes: z.string().trim().max(500),
});
type CheckoutForm = z.infer<typeof checkoutSchema>;

export function CheckoutPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const idempotencyKey = useRef<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const preview = useQuery({
    queryKey: ["checkout-preview"],
    queryFn: getCheckoutPreview,
    retry: false,
  });
  const form = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      recipientName: "",
      phone: "",
      addressLine: "",
      provinceCity: "",
      district: "",
      ward: "",
      notes: "",
    },
  });
  const checkout = useMutation({
    mutationFn: async (values: CheckoutForm) => {
      if (!preview.data) throw new Error("CHECKOUT_PREVIEW_MISSING");
      idempotencyKey.current ??= crypto.randomUUID();
      return submitCheckout(
        {
          ...values,
          ...(values.district ? { district: values.district } : {}),
          ...(values.ward ? { ward: values.ward } : {}),
          ...(values.notes ? { notes: values.notes } : {}),
          shippingMethod: "STANDARD",
          paymentMethod: "COD",
          quoteToken: preview.data.quoteToken,
        },
        idempotencyKey.current,
      );
    },
    onSuccess: (order) => {
      queryClient.removeQueries({ queryKey: cartQueryKey });
      router.push(`/order-confirmation/${encodeURIComponent(order.orderCode)}`);
    },
    onError: async (error) => {
      if (error instanceof ApiClientError) {
        const code = error.payload.error.code;
        if (
          code === "CHECKOUT_QUOTE_CHANGED" ||
          code === "CHECKOUT_CART_CONFLICT" ||
          code === "INSUFFICIENT_STOCK" ||
          code === "CHECKOUT_STOCK_CONFLICT"
        ) {
          setServerError(
            "Giá hoặc tình trạng hàng vừa thay đổi. FARTA đã cập nhật lại bản xác nhận; vui lòng kiểm tra trước khi thử lại.",
          );
          idempotencyKey.current = null;
          await preview.refetch();
          return;
        }
        if (error.status === 401 || error.status === 403) {
          setServerError(
            "Phiên đăng nhập hoặc xác thực bảo mật đã hết hạn. Vui lòng tải lại trang hoặc đăng nhập lại.",
          );
          return;
        }
      }
      setServerError(
        "Chưa thể tạo đơn hàng. Bạn có thể thử lại an toàn mà không tạo đơn trùng.",
      );
    },
  });

  if (preview.isPending) {
    return (
      <main
        id="main-content"
        className="checkout-page checkout-state"
        aria-busy="true"
      >
        <p>Đang xác nhận giá và tình trạng sản phẩm…</p>
      </main>
    );
  }
  if (preview.isError) {
    return (
      <main id="main-content" className="checkout-page checkout-state">
        <h1>Chưa thể bắt đầu thanh toán</h1>
        <p>Giỏ hàng có thể trống, đã thay đổi hoặc kết nối đang gián đoạn.</p>
        <div className="state-actions">
          <button
            className="button button--quiet"
            onClick={() => preview.refetch()}
          >
            Thử lại
          </button>
          <Link className="button button--primary" href="/cart">
            Về giỏ hàng
          </Link>
        </div>
      </main>
    );
  }

  const hasConflicts = preview.data.conflicts.length > 0;
  return (
    <main id="main-content" className="checkout-page">
      <header className="checkout-heading">
        <p className="eyebrow">FARTA Checkout</p>
        <h1>Xác nhận lựa chọn.</h1>
        <p>Giá và tồn kho được máy chủ kiểm tra lại khi bạn đặt hàng.</p>
      </header>
      <form
        className="checkout-layout"
        noValidate
        onSubmit={form.handleSubmit((values) => {
          setServerError(null);
          checkout.mutate(values);
        })}
      >
        <div className="checkout-form-sections">
          <fieldset>
            <legend>Thông tin người nhận</legend>
            <div className="checkout-fields checkout-fields--two">
              <CheckoutField
                id="checkout-recipient-name"
                label="Họ tên"
                error={form.formState.errors.recipientName?.message}
              >
                <input
                  autoComplete="name"
                  {...form.register("recipientName")}
                />
              </CheckoutField>
              <CheckoutField
                id="checkout-phone"
                label="Số điện thoại"
                error={form.formState.errors.phone?.message}
              >
                <input
                  autoComplete="tel"
                  inputMode="tel"
                  {...form.register("phone")}
                />
              </CheckoutField>
            </div>
          </fieldset>
          <fieldset>
            <legend>Địa chỉ giao hàng</legend>
            <div className="checkout-fields">
              <CheckoutField
                id="checkout-address"
                label="Địa chỉ"
                error={form.formState.errors.addressLine?.message}
              >
                <input
                  autoComplete="street-address"
                  {...form.register("addressLine")}
                />
              </CheckoutField>
              <CheckoutField
                id="checkout-province-city"
                label="Tỉnh / Thành phố"
                error={form.formState.errors.provinceCity?.message}
              >
                <input
                  autoComplete="address-level1"
                  {...form.register("provinceCity")}
                />
              </CheckoutField>
              <div className="checkout-fields checkout-fields--two">
                <CheckoutField
                  id="checkout-district"
                  label="Quận / Huyện"
                  error={form.formState.errors.district?.message}
                >
                  <input
                    autoComplete="address-level2"
                    {...form.register("district")}
                  />
                </CheckoutField>
                <CheckoutField
                  id="checkout-ward"
                  label="Phường / Xã"
                  error={form.formState.errors.ward?.message}
                >
                  <input
                    autoComplete="address-level3"
                    {...form.register("ward")}
                  />
                </CheckoutField>
              </div>
              <CheckoutField
                id="checkout-notes"
                label="Ghi chú"
                error={form.formState.errors.notes?.message}
              >
                <textarea rows={3} {...form.register("notes")} />
              </CheckoutField>
            </div>
          </fieldset>
          <fieldset>
            <legend>Giao hàng & thanh toán</legend>
            <div className="checkout-choice">
              <span className="checkout-choice__indicator" aria-hidden="true">
                ✓
              </span>
              <span>
                <strong>Giao hàng tiêu chuẩn</strong>
                <small>{formatVnd(preview.data.shippingFee)}</small>
              </span>
            </div>
            <div className="checkout-choice">
              <span className="checkout-choice__indicator" aria-hidden="true">
                ✓
              </span>
              <span>
                <strong>Thanh toán khi nhận hàng (COD)</strong>
                <small>Chưa thu tiền. Thanh toán cho đơn vị giao hàng.</small>
              </span>
            </div>
          </fieldset>
        </div>
        <aside className="checkout-summary">
          <h2>Đơn hàng</h2>
          <div className="checkout-lines">
            {preview.data.items.map((item) => (
              <article key={item.id}>
                <div className="checkout-line-media">
                  <MediaFrame
                    media={item.image}
                    fallbackLabel={item.product?.name ?? item.variant.sku}
                  />
                </div>
                <div>
                  <strong>
                    {item.product?.name ?? "Sản phẩm không khả dụng"}
                  </strong>
                  <p>
                    {item.variant.color} · {item.variant.size} · SL{" "}
                    {item.quantity}
                  </p>
                  <span>{formatVnd(item.lineSubtotal)}</span>
                </div>
              </article>
            ))}
          </div>
          <dl className="price-summary">
            <div>
              <dt>Tạm tính</dt>
              <dd>{formatVnd(preview.data.itemsSubtotal)}</dd>
            </div>
            <div>
              <dt>Vận chuyển</dt>
              <dd>{formatVnd(preview.data.shippingFee)}</dd>
            </div>
            <div className="price-summary__total">
              <dt>Tổng</dt>
              <dd>{formatVnd(preview.data.total)}</dd>
            </div>
          </dl>
          {hasConflicts && (
            <p className="form-error" role="alert">
              Giỏ hàng có sản phẩm cần kiểm tra lại trước khi đặt hàng.
            </p>
          )}
          {serverError && (
            <p className="form-error" role="alert">
              {serverError}
            </p>
          )}
          <button
            className="button button--primary button--wide"
            disabled={checkout.isPending || hasConflicts}
            type="submit"
          >
            {checkout.isPending
              ? "Đang tạo đơn an toàn…"
              : `Đặt hàng COD · ${formatVnd(preview.data.total)}`}
          </button>
          <p className="checkout-note">
            Bằng việc đặt hàng, bạn xác nhận thông tin giao nhận ở trên là chính
            xác.
          </p>
        </aside>
      </form>
    </main>
  );
}

function CheckoutField({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error: string | undefined;
  children: ReactElement<{
    id?: string;
    "aria-invalid"?: boolean;
    "aria-describedby"?: string;
  }>;
}) {
  const errorId = `${id}-error`;
  return (
    <label htmlFor={id}>
      {label}
      {cloneElement(children, {
        id,
        "aria-invalid": Boolean(error),
        ...(error ? { "aria-describedby": errorId } : {}),
      })}
      {error && (
        <span className="field-error" id={errorId}>
          {error}
        </span>
      )}
    </label>
  );
}
