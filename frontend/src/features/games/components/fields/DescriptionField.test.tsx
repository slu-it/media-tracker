import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../test/renderWithProviders";
import { DescriptionField } from "./DescriptionField";

describe("DescriptionField", () => {
  it("shows a character counter and reports typed input", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<DescriptionField value="" onChange={onChange} />);
    expect(screen.getByText("0/10000")).toBeInTheDocument();

    await user.type(screen.getByRole("textbox", { name: /description/i }), "A");
    expect(onChange).toHaveBeenCalledWith("A");
  });

  it("reports too-long text with showErrors", () => {
    renderWithProviders(<DescriptionField value={"x".repeat(10001)} onChange={() => {}} showErrors />);
    expect(screen.getByText("At most 10000 characters")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
  });

  it("stays valid at the exact character limit", () => {
    renderWithProviders(<DescriptionField value={"x".repeat(10000)} onChange={() => {}} showErrors />);
    expect(screen.getByText("10000/10000")).toBeInTheDocument();
  });
});
