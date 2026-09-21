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
});
