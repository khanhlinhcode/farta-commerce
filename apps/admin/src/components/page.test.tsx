import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConfirmationDialog } from "./page";

function DialogHarness({ onConfirm = vi.fn() }: { onConfirm?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} type="button">
        Lưu trữ
      </button>
      {open && (
        <ConfirmationDialog
          confirmLabel="Xác nhận"
          onCancel={() => setOpen(false)}
          onConfirm={onConfirm}
          title="Lưu trữ sản phẩm?"
        >
          <p>Thao tác này thay đổi khả năng hiển thị.</p>
        </ConfirmationDialog>
      )}
    </>
  );
}

describe("ConfirmationDialog", () => {
  afterEach(cleanup);

  it("moves focus into the dialog, closes on Escape and restores focus", () => {
    render(<DialogHarness />);
    const trigger = screen.getByRole("button", { name: "Lưu trữ" });
    trigger.focus();
    fireEvent.click(trigger);

    const cancel = screen.getByRole("button", { name: "Hủy" });
    expect(cancel).toHaveFocus();
    expect(screen.getByRole("alertdialog")).toHaveAccessibleName(
      "Lưu trữ sản phẩm?",
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
