import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { YearNavigator } from "./YearNavigator";

const LABEL = "Year selection";

function navigator() {
  return screen.getByRole("group", { name: LABEL });
}

describe("YearNavigator", () => {
  it("moves to the previous year when the older button is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <YearNavigator years={[2026, 2020, 2018]} value={2020} onChange={onChange} ariaLabel={LABEL} />,
    );

    await user.click(within(navigator()).getByRole("button", { name: "Previous year" }));
    expect(onChange).toHaveBeenCalledWith(2018);
  });

  it("moves to the next year when the newer button is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <YearNavigator years={[2026, 2020, 2018]} value={2020} onChange={onChange} ariaLabel={LABEL} />,
    );

    await user.click(within(navigator()).getByRole("button", { name: "Next year" }));
    expect(onChange).toHaveBeenCalledWith(2026);
  });

  it("disables the older button at the oldest offered year", () => {
    renderWithProviders(
      <YearNavigator years={[2026, 2020, 2018]} value={2018} onChange={() => {}} ariaLabel={LABEL} />,
    );
    expect(within(navigator()).getByRole("button", { name: "Previous year" })).toBeDisabled();
    expect(within(navigator()).getByRole("button", { name: "Next year" })).toBeEnabled();
  });

  it("disables the newer button at the newest offered year", () => {
    renderWithProviders(
      <YearNavigator years={[2026, 2020, 2018]} value={2026} onChange={() => {}} ariaLabel={LABEL} />,
    );
    expect(within(navigator()).getByRole("button", { name: "Next year" })).toBeDisabled();
    expect(within(navigator()).getByRole("button", { name: "Previous year" })).toBeEnabled();
  });

  it("lists every offered year in the dropdown and reports the pick", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <YearNavigator years={[2026, 2020, 2018]} value={2026} onChange={onChange} ariaLabel={LABEL} />,
    );

    await user.click(within(navigator()).getByRole("combobox", { name: "Year" }));
    await screen.findByRole("listbox");
    expect(screen.getAllByRole("option")).toHaveLength(3);
    await user.click(screen.getByRole("option", { name: "2018" }));

    expect(onChange).toHaveBeenCalledWith(2018);
  });
});
