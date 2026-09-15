import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../test/renderWithProviders";
import { currentYear } from "../../domain/gameValues";
import { ReleaseYearField } from "./ReleaseYearField";

describe("ReleaseYearField", () => {
  it("lists the years from the current year down to 1980 and reports a number", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<ReleaseYearField value={null} onChange={onChange} />);

    await user.click(screen.getByRole("combobox", { name: /release year/i }));
    const options = screen.getAllByRole("option").map((o) => Number(o.textContent));
    expect(options[0]).toBe(currentYear());
    expect(options.at(-1)).toBe(1980);
    await user.click(screen.getByRole("option", { name: "2018" }));
    expect(onChange).toHaveBeenCalledWith(2018);
  });

  it("still displays a stored year outside the selectable range", () => {
    renderWithProviders(<ReleaseYearField value={1975} onChange={() => {}} />);
    expect(screen.getByRole("combobox", { name: /release year/i })).toHaveTextContent("1975");
  });

  it("shows the required error when asked to", () => {
    renderWithProviders(<ReleaseYearField value={null} onChange={() => {}} showErrors />);
    expect(screen.getByText("Required")).toBeInTheDocument();
  });
});
