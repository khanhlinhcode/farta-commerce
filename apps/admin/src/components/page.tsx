import { useEffect, useId, useRef, type ReactNode } from "react";

import { Button, Surface } from "@farta/ui";

import { errorMessage } from "../lib/errors";

export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="page-header">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  );
}

export function QueryState({
  pending,
  error,
}: {
  pending: boolean;
  error: unknown;
}) {
  if (pending)
    return (
      <p role="status" className="state-card">
        Đang tải dữ liệu vận hành…
      </p>
    );
  if (error)
    return (
      <p role="alert" className="state-card error">
        {errorMessage(error)}
      </p>
    );
  return null;
}

export function Metric({
  label,
  value,
}: {
  label: string;
  value: number | undefined;
}) {
  return (
    <Surface className="metric">
      <span>{label}</span>
      <strong>{value ?? "—"}</strong>
    </Surface>
  );
}

export function Status({ value }: { value: string }) {
  return (
    <span className={`status status-${value.toLowerCase()}`}>{value}</span>
  );
}

export function PermissionDeniedState() {
  return (
    <main className="center-state" role="alert">
      Bạn không có quyền truy cập khu vực quản trị này.
    </main>
  );
}

export function ConfirmationDialog({
  title,
  children,
  confirmLabel,
  pending = false,
  error,
  onConfirm,
  onCancel,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  pending?: boolean;
  error?: unknown;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;
  const returnFocus = useRef<HTMLElement | null>(
    typeof document === "undefined"
      ? null
      : (document.activeElement as HTMLElement | null),
  );

  useEffect(() => {
    cancelRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancelRef.current();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      returnFocus.current?.focus();
    };
  }, []);

  return (
    <div
      aria-labelledby={titleId}
      aria-modal="true"
      className="inline-confirmation"
      role="alertdialog"
    >
      <Surface className="panel">
        <h2 id={titleId}>{title}</h2>
        {children}
        {Boolean(error) && (
          <p role="alert" className="form-error">
            {errorMessage(error)}
          </p>
        )}
        <div className="security-actions">
          <Button disabled={pending} onClick={onConfirm}>
            {confirmLabel}
          </Button>
          <button onClick={onCancel} ref={cancelRef} type="button">
            Hủy
          </button>
        </div>
      </Surface>
    </div>
  );
}
