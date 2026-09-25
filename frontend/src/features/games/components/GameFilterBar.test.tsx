import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { meta } from "../../../test/fixtures/games";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { EMPTY_FILTERS } from "../domain/gameFilters";
import { GameFilterBar } from "./GameFilterBar";

describe("GameFilterBar", () => {
  it("shows the placeholder for every filter when nothing is selected", () => {
    renderWithProviders(<GameFilterBar filters={EMPTY_FILTERS} onChange={() => {}} meta={meta} />);

    expect(screen.getByRole("combobox", { name: "Platform" })).toHaveTextContent("-all-");
    expect(screen.getByRole("combobox", { name: "Ownership" })).toHaveTextContent("-all-");
    expect(screen.getByRole("combobox", { name: "Progress" })).toHaveTextContent("-all-");
    expect(screen.getByRole("combobox", { name: "Release year" })).toHaveTextContent("-all-");
  });

  it("offers the values from the meta payload", async () => {
    const user = userEvent.setup();
    renderWithProviders(<GameFilterBar filters={EMPTY_FILTERS} onChange={() => {}} meta={meta} />);

    await user.click(screen.getByRole("combobox", { name: "Platform" }));
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Nintendo", "PC"]);
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("combobox", { name: "Ownership" }));
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Watchlist", "Owned"]);
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("combobox", { name: "Progress" }));
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Playing", "100%"]);
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("combobox", { name: "Release year" }));
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["2018", "2020"]);
  });

  it("reports both values once two are selected in one filter", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <GameFilterBar filters={{ ...EMPTY_FILTERS, platformIds: ["platform-pc"] }} onChange={onChange} meta={meta} />,
    );

    await user.click(screen.getByRole("combobox", { name: "Platform" }));
    await user.click(screen.getByRole("option", { name: "Nintendo" }));

    expect(onChange).toHaveBeenLastCalledWith({
      ...EMPTY_FILTERS,
      platformIds: ["platform-pc", "platform-nintendo"],
    });
  });

  it("disables a filter whose values are not part of the meta payload", () => {
    const partialMeta = { ...meta, progress: [] };
    renderWithProviders(<GameFilterBar filters={EMPTY_FILTERS} onChange={() => {}} meta={partialMeta} />);

    expect(screen.getByRole("combobox", { name: "Progress" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("combobox", { name: "Platform" })).not.toHaveAttribute("aria-disabled");
  });

  it("disables every filter while the meta payload is still loading", () => {
    renderWithProviders(<GameFilterBar filters={EMPTY_FILTERS} onChange={() => {}} meta={null} />);

    expect(screen.getByRole("combobox", { name: "Platform" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("combobox", { name: "Ownership" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("combobox", { name: "Progress" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("combobox", { name: "Release year" })).toHaveAttribute("aria-disabled", "true");
  });

  it("shows the clear button only while the platform filter has a selection", () => {
    const { rerender } = renderWithProviders(<GameFilterBar filters={EMPTY_FILTERS} onChange={() => {}} meta={meta} />);
    expect(screen.queryByRole("button", { name: "Clear Platform" })).not.toBeInTheDocument();

    rerender(
      <GameFilterBar filters={{ ...EMPTY_FILTERS, platformIds: ["platform-pc"] }} onChange={() => {}} meta={meta} />,
    );
    expect(screen.getByRole("button", { name: "Clear Platform" })).toBeInTheDocument();
  });

  it("hides the clear button while the filter is disabled even with a selection", () => {
    renderWithProviders(
      <GameFilterBar
        filters={{ ...EMPTY_FILTERS, platformIds: ["platform-pc"] }}
        onChange={() => {}}
        meta={meta}
        disabled
      />,
    );

    expect(screen.queryByRole("button", { name: "Clear Platform" })).not.toBeInTheDocument();
  });

  it("resets the filter and does not open the menu when the clear button is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <GameFilterBar filters={{ ...EMPTY_FILTERS, platformIds: ["platform-pc"] }} onChange={onChange} meta={meta} />,
    );

    await user.click(screen.getByRole("button", { name: "Clear Platform" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_FILTERS, platformIds: [] });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    // Positive control: the combobox itself still opens the menu normally, so the assertion above is meaningful.
    await user.click(screen.getByRole("combobox", { name: "Platform" }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("moves focus back to the combobox once the clear button is activated by keyboard", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <GameFilterBar filters={{ ...EMPTY_FILTERS, platformIds: ["platform-pc"] }} onChange={onChange} meta={meta} />,
    );

    await user.tab();
    expect(screen.getByRole("combobox", { name: "Platform" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Clear Platform" })).toHaveFocus();

    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_FILTERS, platformIds: [] });
    expect(screen.getByRole("combobox", { name: "Platform" })).toHaveFocus();
  });
});
