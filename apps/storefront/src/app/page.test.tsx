import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "./page";

describe("storefront shell", () => {
  it("identifies itself without presenting fake commerce", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Fashion",
    );
    expect(screen.getByText(/No fake catalog/i)).toBeInTheDocument();
  });
});
