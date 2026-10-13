import { Surface } from "@farta/ui";

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
