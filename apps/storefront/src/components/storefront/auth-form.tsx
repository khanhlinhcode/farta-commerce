"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { mergeCart } from "@/lib/cart";

const loginSchema = z.object({
  email: z.email("Email không hợp lệ."),
  password: z.string().min(1, "Nhập mật khẩu.").max(128),
});
const registerSchema = loginSchema.extend({
  displayName: z.string().trim().min(1, "Nhập tên hiển thị.").max(100),
  password: z.string().min(12, "Mật khẩu cần ít nhất 12 ký tự.").max(128),
});
type LoginInput = z.infer<typeof loginSchema>;

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const schema = mode === "login" ? loginSchema : registerSchema;
  const form = useForm<LoginInput & { displayName?: string }>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", displayName: "" },
  });

  async function submit(values: LoginInput & { displayName?: string }) {
    setServerError(null);
    try {
      const csrf = await fetch("/api/v1/auth/customer/csrf", {
        credentials: "include",
      });
      if (!csrf.ok) throw new Error("AUTH_UNAVAILABLE");
      const csrfBody = (await csrf.json()) as { csrfToken: string };
      const response = await fetch(`/api/v1/auth/customer/${mode}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfBody.csrfToken,
        },
        body: JSON.stringify(
          mode === "login"
            ? { email: values.email, password: values.password }
            : {
                email: values.email,
                password: values.password,
                displayName: values.displayName,
              },
        ),
      });
      if (!response.ok) {
        if (response.status === 429)
          setServerError(
            "Bạn đã thử quá nhiều lần. Vui lòng đợi trước khi thử lại.",
          );
        else
          setServerError(
            mode === "login"
              ? "Thông tin đăng nhập không hợp lệ."
              : "Không thể tạo tài khoản với thông tin này.",
          );
        return;
      }
      const authenticated = (await response.json()) as { csrfToken: string };
      let cartNeedsReview = false;
      try {
        await mergeCart(authenticated.csrfToken);
      } catch {
        cartNeedsReview = true;
      }
      router.push(cartNeedsReview ? "/account?cart=review" : "/account");
      router.refresh();
    } catch {
      setServerError(
        "Dịch vụ đăng nhập đang tạm gián đoạn. Vui lòng thử lại sau.",
      );
    }
  }

  return (
    <form className="auth-form" onSubmit={form.handleSubmit(submit)} noValidate>
      {mode === "register" && (
        <label>
          Họ tên
          <input
            id="auth-display-name"
            autoComplete="name"
            {...form.register("displayName")}
            aria-invalid={Boolean(form.formState.errors.displayName)}
            aria-describedby={
              form.formState.errors.displayName
                ? "auth-display-name-error"
                : undefined
            }
          />
          {form.formState.errors.displayName && (
            <span className="field-error" id="auth-display-name-error">
              {form.formState.errors.displayName.message}
            </span>
          )}
        </label>
      )}
      <label>
        Email
        <input
          id="auth-email"
          autoComplete="email"
          type="email"
          {...form.register("email")}
          aria-invalid={Boolean(form.formState.errors.email)}
          aria-describedby={
            form.formState.errors.email ? "auth-email-error" : undefined
          }
        />
        {form.formState.errors.email && (
          <span className="field-error" id="auth-email-error">
            {form.formState.errors.email.message}
          </span>
        )}
      </label>
      <label>
        Mật khẩu
        <input
          id="auth-password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          type="password"
          {...form.register("password")}
          aria-invalid={Boolean(form.formState.errors.password)}
          aria-describedby={
            form.formState.errors.password ? "auth-password-error" : undefined
          }
        />
        {form.formState.errors.password && (
          <span className="field-error" id="auth-password-error">
            {form.formState.errors.password.message}
          </span>
        )}
      </label>
      {serverError && (
        <p className="form-error" role="alert">
          {serverError}
        </p>
      )}
      <button
        className="button button--primary button--wide"
        disabled={form.formState.isSubmitting}
        type="submit"
      >
        {form.formState.isSubmitting
          ? "Đang xử lý…"
          : mode === "login"
            ? "Đăng nhập"
            : "Tạo tài khoản"}
      </button>
      <div className="oauth-boundary">
        <button disabled type="button">
          Tiếp tục với Google — chưa cấu hình
        </button>
        <button disabled type="button">
          Tiếp tục với Apple — chưa cấu hình
        </button>
      </div>
      <p>
        {mode === "login" ? (
          <>
            <Link href="/forgot-password">Quên mật khẩu?</Link>
            <br />
            Chưa có tài khoản? <Link href="/register">Đăng ký</Link>
          </>
        ) : (
          <>
            Đã có tài khoản? <Link href="/login">Đăng nhập</Link>
          </>
        )}
      </p>
    </form>
  );
}
