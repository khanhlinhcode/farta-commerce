import { LockKeyhole, PackageSearch, ShieldCheck } from "lucide-react";
import { Navigate, Route, Routes } from "react-router-dom";

import { Container, Surface } from "@farta/ui";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

function ProtectedRoute({
  status,
  children,
}: {
  status: AuthStatus;
  children: React.ReactNode;
}) {
  if (status === "loading")
    return <p role="status">Đang kiểm tra phiên quản trị…</p>;
  if (status === "unauthenticated") return <Navigate replace to="/login" />;
  return children;
}

function LoginBoundary() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <Surface className="w-full max-w-md border border-[var(--farta-color-border)] p-8">
        <LockKeyhole />
        <h1 className="mt-8 font-[var(--farta-font-display)] text-4xl">
          FARTA Admin
        </h1>
        <p className="mt-3 leading-7 text-[var(--farta-color-text-muted)]">
          Staff authentication is intentionally unavailable until the separate
          admin realm passes the security foundation gate.
        </p>
      </Surface>
    </main>
  );
}

function DashboardShell() {
  return (
    <Container className="py-10">
      <header className="flex items-center justify-between border-b border-[var(--farta-color-border)] pb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em]">Operations</p>
          <h1 className="font-[var(--farta-font-display)] text-4xl">
            Foundation dashboard
          </h1>
        </div>
        <ShieldCheck aria-label="Protected realm" />
      </header>
      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        <Surface className="border border-[var(--farta-color-border)] p-6">
          <PackageSearch />
          <h2 className="mt-6 text-lg font-semibold">No fake operations</h2>
          <p className="mt-2 text-sm text-[var(--farta-color-text-muted)]">
            Catalog and order management arrive only with authorized backend
            domains.
          </p>
        </Surface>
      </section>
    </Container>
  );
}

export function App() {
  const authStatus: AuthStatus = "unauthenticated";
  return (
    <Routes>
      <Route path="/login" element={<LoginBoundary />} />
      <Route
        path="/"
        element={
          <ProtectedRoute status={authStatus}>
            <DashboardShell />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
