import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../test/renderWithProviders";
import { OwnershipField } from "./OwnershipField";

describe("OwnershipField", () => {
  it("offers both ownership options and reports the selected value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<OwnershipField value="watchlist" onChange={onChange} />);

    await user.click(screen.getByRole("combobox", { name: /ownership/i }));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Watchlist", "Owned"]);

    await user.click(screen.getByRole("option", { name: "Owned" }));
    expect(onChange).toHaveBeenCalledWith("owned");
  });

  it("can be disabled", () => {
    renderWithProviders(<OwnershipField value="watchlist" onChange={() => {}} disabled />);
    expect(screen.getByRole("combobox", { name: /ownership/i })).toHaveAttribute("aria-disabled", "true");
  });
});
