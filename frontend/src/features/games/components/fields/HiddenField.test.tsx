import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../test/renderWithProviders";
import { HiddenField } from "./HiddenField";

describe("HiddenField", () => {
  it("reports the toggled value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<HiddenField value={false} onChange={onChange} />);

    const checkbox = screen.getByRole("checkbox", { name: /hidden/i });
    expect(checkbox).not.toBeChecked();
    await user.click(checkbox);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("reflects an already-hidden game as checked", () => {
    renderWithProviders(<HiddenField value={true} onChange={() => {}} />);
    expect(screen.getByRole("checkbox", { name: /hidden/i })).toBeChecked();
  });

  it("can be disabled", () => {
    renderWithProviders(<HiddenField value={false} onChange={() => {}} disabled />);
    expect(screen.getByRole("checkbox", { name: /hidden/i })).toBeDisabled();
  });
});
