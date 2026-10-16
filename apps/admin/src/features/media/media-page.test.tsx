import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MediaPage } from "./media-page";

describe("MediaPage", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows a safe provider failure without reporting upload success", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/v1/admin/media/upload-authorizations")) {
        return new Response(
          JSON.stringify({
            error: {
              code: "MEDIA_PROVIDER_UNAVAILABLE",
              message: "Dịch vụ media tạm thời không khả dụng.",
            },
          }),
          { status: 503 },
        );
      }
      if (url.includes("/api/v1/admin/media")) {
        return new Response(JSON.stringify({ items: [] }), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MediaPage />
      </QueryClientProvider>,
    );
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], "look.jpg", {
      type: "image/jpeg",
    });
    fireEvent.change(screen.getByLabelText("Tệp ảnh"), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Tải media" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Dịch vụ media tạm thời không khả dụng.",
    );
  });
});
