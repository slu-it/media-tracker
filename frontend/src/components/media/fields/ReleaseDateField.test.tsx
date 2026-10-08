import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { ReleaseDateField } from "./ReleaseDateField";

// The MUI X field renders as an accessible group whose sections are `spinbutton`s (year, month, day, per
// `RELEASE_DATE_FORMAT`); edit one via `user.click` (selects the section) then digits, per the MUI X Testing
// Library guidance. Editing a single already-filled digit avoids the multi-keystroke accumulation a fresh 4-digit
// year section needs, which is flaky to drive through jsdom's limited contenteditable/selection support.

describe("ReleaseDateField", () => {
  it("propagates the changed ISO date for a valid edit", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<ReleaseDateField value="2020-04-01" onChange={onChange} />);
    const field = screen.getByRole("group", { name: "Release date" });

    await user.click(within(field).getByRole("spinbutton", { name: "Month" }));
    await user.keyboard("6");

    expect(onChange).toHaveBeenCalledWith("2020-06-01");
  });

  it("shows an existing value and clears it via the field's clear button", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<ReleaseDateField value="2020-04-01" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Clear" }));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("shows the out-of-range error and does not propagate a year before 1000", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<ReleaseDateField value="2020-04-01" onChange={onChange} />);
    const field = screen.getByRole("group", { name: "Release date" });

    await user.click(within(field).getByRole("spinbutton", { name: "Year" }));
    await user.keyboard("0");

    expect(await screen.findByText("Must be a valid date with a four-digit year")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows no error for an empty value unless asked to", () => {
    renderWithProviders(<ReleaseDateField value={null} onChange={() => {}} showErrors={false} />);
    expect(screen.queryByText("Must be a valid date with a four-digit year")).not.toBeInTheDocument();
  });

  it("keeps the fixed ISO format even when the UI language is German", async () => {
    await i18n.changeLanguage("de");
    renderWithProviders(<ReleaseDateField value="2020-04-01" onChange={() => {}} />);

    // `format={RELEASE_DATE_FORMAT}` is passed explicitly, so the field's own hidden input (which always holds
    // the fully assembled value, unlike the per-section spinbuttons whose accessible names do localize, e.g. to
    // "Jahr"/"Monat"/"Tag") stays year-month-day regardless of locale.
    expect(screen.getByDisplayValue("2020-04-01")).toBeInTheDocument();
  });
});
