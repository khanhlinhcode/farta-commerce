import type { ReactNode } from "react";

export function AuthShell({
  eyebrow,
  title,
  detail,
  children,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  children: ReactNode;
}) {
  return (
    <main id="main-content" className="auth-page">
      <section className="auth-editorial" aria-hidden="true">
        <span>FARTA / Identity</span>
        <p>Style is a language spoken before words.</p>
      </section>
      <section className="auth-surface">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{detail}</p>
          {children}
        </div>
      </section>
    </main>
  );
}
