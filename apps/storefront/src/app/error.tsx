"use client";

import { Button, Container } from "@farta/ui";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // A production error-tracking adapter will receive a redacted event in Phase 2.
    console.error("Storefront boundary error", { digest: error.digest });
  }, [error]);

  return (
    <Container className="py-24">
      <h2 className="font-[var(--farta-font-display)] text-4xl">
        Không thể tải trang.
      </h2>
      <p className="mt-3 text-[var(--farta-color-text-muted)]">
        Vui lòng thử lại. Không có dữ liệu đơn hàng nào được gửi.
      </p>
      <Button className="mt-8" onClick={reset}>
        Thử lại
      </Button>
    </Container>
  );
}
