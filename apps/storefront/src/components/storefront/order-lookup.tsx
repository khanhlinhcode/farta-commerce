"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { GuestOrderLookupReadModel } from "@farta/types";

import { ApiClientError } from "@/lib/api-client";
import { lookupOrder } from "@/lib/checkout";
import { OrderDetailView } from "./order-detail";

const schema = z.object({
  orderCode: z
    .string()
    .trim()
    .regex(/^FAR-[0-9]{8}-[A-Z2-9]{10}$/, "Mã đơn hàng chưa hợp lệ."),
  phone: z.string().trim().min(9, "Số điện thoại chưa hợp lệ.").max(30),
});
type Input = z.infer<typeof schema>;

export function OrderLookup() {
  const [order, setOrder] = useState<GuestOrderLookupReadModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<Input>({
    resolver: zodResolver(schema),
    defaultValues: { orderCode: "", phone: "" },
  });
  if (order) return <OrderDetailView order={order} />;
  return (
    <main id="main-content" className="lookup-page">
      <div>
        <p className="eyebrow">Theo dõi đơn hàng</p>
        <h1>Một mã đơn. Một hành trình.</h1>
        <p>
          Nhập mã đơn và số điện thoại người nhận. FARTA không hiển thị đơn hàng
          chỉ dựa vào mã.
        </p>
      </div>
      <form
        noValidate
        onSubmit={form.handleSubmit(async (input) => {
          setError(null);
          try {
            setOrder(await lookupOrder(input.orderCode, input.phone));
          } catch (lookupError) {
            if (lookupError instanceof ApiClientError) {
              if (lookupError.status === 404) {
                setError("Không tìm thấy đơn hàng với thông tin đã nhập.");
                return;
              }
              if (lookupError.status === 429) {
                setError("Bạn đã tra cứu quá nhanh. Vui lòng thử lại sau.");
                return;
              }
            }
            setError("Dịch vụ tra cứu đang gián đoạn. Vui lòng thử lại sau.");
          }
        })}
      >
        <label>
          Mã đơn hàng
          <input
            id="lookup-order-code"
            autoCapitalize="characters"
            aria-invalid={Boolean(form.formState.errors.orderCode)}
            aria-describedby={
              form.formState.errors.orderCode
                ? "lookup-order-code-error"
                : undefined
            }
            {...form.register("orderCode")}
          />
          {form.formState.errors.orderCode && (
            <span className="field-error" id="lookup-order-code-error">
              {form.formState.errors.orderCode.message}
            </span>
          )}
        </label>
        <label>
          Số điện thoại người nhận
          <input
            id="lookup-phone"
            inputMode="tel"
            aria-invalid={Boolean(form.formState.errors.phone)}
            aria-describedby={
              form.formState.errors.phone ? "lookup-phone-error" : undefined
            }
            {...form.register("phone")}
          />
          {form.formState.errors.phone && (
            <span className="field-error" id="lookup-phone-error">
              {form.formState.errors.phone.message}
            </span>
          )}
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="button button--primary button--wide"
          disabled={form.formState.isSubmitting}
          type="submit"
        >
          {form.formState.isSubmitting ? "Đang tra cứu…" : "Tra cứu đơn hàng"}
        </button>
      </form>
    </main>
  );
}
