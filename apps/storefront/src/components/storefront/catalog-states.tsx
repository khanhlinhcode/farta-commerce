import Link from "next/link";
import { RetryButton } from "./retry-button";

export function CatalogState({
  kind,
  title,
  detail,
}: {
  kind: "empty" | "error";
  title: string;
  detail: string;
}) {
  return (
    <section
      className={`catalog-state catalog-state--${kind}`}
      role={kind === "error" ? "alert" : "status"}
    >
      <span aria-hidden="true">{kind === "error" ? "—" : "○"}</span>
      <h2>{title}</h2>
      <p>{detail}</p>
      <div className="catalog-state__actions">
        {kind === "error" && <RetryButton />}
        <Link href="/shop">Trở về cửa hàng</Link>
      </div>
    </section>
  );
}
