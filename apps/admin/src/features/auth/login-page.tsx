import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LogIn, ShieldCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";

import { Button, Surface } from "@farta/ui";

import { adminApi } from "../../lib/api";
import { errorMessage } from "../../lib/errors";
import { loginSchema, type LoginInput } from "./auth-schema";

export function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const login = useMutation({
    mutationFn: (values: LoginInput) =>
      adminApi.login(values.email, values.password),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["staff-me"] });
      navigate("/", { replace: true });
    },
  });
  return (
    <main className="auth-layout">
      <section className="auth-editorial" aria-hidden="true">
        <p>FARTA / Operations</p>
        <h1>Quản trị thời trang, vận hành bằng dữ liệu đáng tin cậy.</h1>
      </section>
      <Surface className="auth-card">
        <ShieldCheck size={26} />
        <p className="eyebrow">Protected staff realm</p>
        <h2>Đăng nhập FARTA Admin</h2>
        <form
          onSubmit={form.handleSubmit((values) => login.mutate(values))}
          noValidate
        >
          <label>
            Email
            <input
              id="staff-login-email"
              aria-invalid={Boolean(form.formState.errors.email)}
              aria-describedby={
                form.formState.errors.email
                  ? "staff-login-email-error"
                  : undefined
              }
              autoComplete="username"
              type="email"
              {...form.register("email")}
            />
          </label>
          {form.formState.errors.email && (
            <p className="field-error" id="staff-login-email-error">
              {form.formState.errors.email.message}
            </p>
          )}
          <label>
            Mật khẩu
            <input
              id="staff-login-password"
              aria-invalid={Boolean(form.formState.errors.password)}
              aria-describedby={
                form.formState.errors.password
                  ? "staff-login-password-error"
                  : undefined
              }
              autoComplete="current-password"
              type="password"
              {...form.register("password")}
            />
          </label>
          {form.formState.errors.password && (
            <p className="field-error" id="staff-login-password-error">
              {form.formState.errors.password.message}
            </p>
          )}
          {login.error && (
            <p className="form-error" role="alert">
              {errorMessage(login.error)}
            </p>
          )}
          <Button className="w-full" disabled={login.isPending} type="submit">
            <LogIn aria-hidden="true" size={17} strokeWidth={1.7} />
            {login.isPending ? "Đang xác thực…" : "Đăng nhập"}
          </Button>
        </form>
      </Surface>
    </main>
  );
}
