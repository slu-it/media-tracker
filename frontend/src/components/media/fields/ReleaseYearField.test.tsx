import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { currentYear, RELEASE_YEAR_SELECT_YEARS_AHEAD } from "../../../domain/media/values";
import { ReleaseYearField } from "./ReleaseYearField";

describe("ReleaseYearField", () => {
  it("lists the years from two years ahead down to 1980 and reports a number", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<ReleaseYearField value={null} onChange={onChange} />);

    await user.click(screen.getByRole("combobox", { name: /release year/i }));
    const options = screen.getAllByRole("option").map((o) => Number(o.textContent));
    expect(options[0]).toBe(currentYear() + RELEASE_YEAR_SELECT_YEARS_AHEAD);
    expect(options.at(-1)).toBe(1980);
    await user.click(screen.getByRole("option", { name: "2018" }));
    expect(onChange).toHaveBeenCalledWith(2018);
  });

  it("still displays a stored year outside the selectable range, last when older", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReleaseYearField value={1975} onChange={() => {}} />);
    const combobox = screen.getByRole("combobox", { name: /release year/i });
    expect(combobox).toHaveTextContent("1975");
    await user.click(combobox);
    const options = screen.getAllByRole("option").map((o) => Number(o.textContent));
    expect(options.at(-1)).toBe(1975);
  });

  it("lists a far-future stored year first", async () => {
    const user = userEvent.setup();
    const farFuture = currentYear() + RELEASE_YEAR_SELECT_YEARS_AHEAD + 3;
    renderWithProviders(<ReleaseYearField value={farFuture} onChange={() => {}} />);
    const combobox = screen.getByRole("combobox", { name: /release year/i });
    expect(combobox).toHaveTextContent(String(farFuture));
    await user.click(combobox);
    const options = screen.getAllByRole("option").map((o) => Number(o.textContent));
    expect(options[0]).toBe(farFuture);
    expect(options[1]).toBe(currentYear() + RELEASE_YEAR_SELECT_YEARS_AHEAD);
  });

  it("lists years down to a custom minYear", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReleaseYearField value={null} onChange={() => {}} minYear={1900} />);
    await user.click(screen.getByRole("combobox", { name: /release year/i }));
    const options = screen.getAllByRole("option").map((o) => Number(o.textContent));
    expect(options.at(-1)).toBe(1900);
  });

  it("shows the required error when asked to", () => {
    renderWithProviders(<ReleaseYearField value={null} onChange={() => {}} showErrors />);
    expect(screen.getByText("Required")).toBeInTheDocument();
  });
});
