import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { App } from "./app";

describe("admin shell", () => {
  it("does not fake an authenticated administrator", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("heading", { name: "FARTA Admin" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/intentionally unavailable/i)).toBeInTheDocument();
  });
});
