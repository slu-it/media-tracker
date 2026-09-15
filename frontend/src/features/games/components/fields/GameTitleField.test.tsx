import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../test/renderWithProviders";
import { GameTitleField } from "./GameTitleField";

describe("GameTitleField", () => {
  it("shows the error only after the field was touched", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<GameTitleField value="" onChange={onChange} />);
    const input = screen.getByRole("textbox", { name: /title/i });
    expect(screen.queryByText("Required")).not.toBeInTheDocument();

    await user.click(input);
    await user.tab();
    expect(screen.getByText("Required")).toBeInTheDocument();

    await user.type(input, "C");
    expect(onChange).toHaveBeenCalledWith("C");
  });

  it("shows errors immediately with showErrors and reports too-long titles", () => {
    renderWithProviders(<GameTitleField value={"x".repeat(257)} onChange={() => {}} showErrors />);
    expect(screen.getByText("At most 256 characters")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
  });

  it("shows a character counter for valid input", () => {
    renderWithProviders(<GameTitleField value="Celeste" onChange={() => {}} />);
    expect(screen.getByText("7/256")).toBeInTheDocument();
  });
});
