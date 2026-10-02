import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { meta } from "../../../test/fixtures/games";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { EMPTY_FILTERS, type GameFilters } from "../domain/gameFilters";
import { StatusFilterToggles } from "./StatusFilterToggles";

function setupToggles(filters: GameFilters = EMPTY_FILTERS, metaValue: typeof meta | null = meta, onChange = vi.fn()) {
  renderWithProviders(<StatusFilterToggles filters={filters} onChange={onChange} meta={metaValue} />);
  return onChange;
}

const progressGroup = () => screen.getByRole("group", { name: "Progress" });
const ownershipGroup = () => screen.getByRole("group", { name: "Ownership" });

describe("StatusFilterToggles", () => {
  it("renders a progress group then an ownership group, buttons named by label, nothing pressed", () => {
    setupToggles();

    const groups = screen.getAllByRole("group");
    expect(groups).toEqual([progressGroup(), ownershipGroup()]);
    expect(
      within(progressGroup())
        .getAllByRole("button")
        .map((b) => b.getAttribute("aria-label")),
    ).toEqual(["Abandoned", "Not started", "Paused", "Playing", "Finished", "100%"]);
    expect(
      within(ownershipGroup())
        .getAllByRole("button")
        .map((b) => b.getAttribute("aria-label")),
    ).toEqual(["Watchlist", "Owned"]);
    for (const button of screen.getAllByRole("button")) expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("renders the status icon in each group's buttons", () => {
    setupToggles();

    expect(
      within(screen.getByRole("button", { name: "Playing" })).getByTestId("SportsEsportsIcon"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("button", { name: "Owned" })).getByTestId("LibraryAddCheckOutlinedIcon"),
    ).toBeInTheDocument();
  });

  it("shows the filtered values as pressed", () => {
    setupToggles({ ...EMPTY_FILTERS, progress: ["playing", "paused"], ownership: ["owned"] });

    expect(screen.getByRole("button", { name: "Playing" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Paused" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Finished" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Owned" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Watchlist" })).toHaveAttribute("aria-pressed", "false");
  });

  it("reports a progress toggle merged into the filters, in values order", async () => {
    const base = {
      ...EMPTY_FILTERS,
      platformIds: ["p1"],
      progress: ["completed" as const],
      ownership: ["owned" as const],
    };
    const onChange = setupToggles(base);

    await userEvent.click(screen.getByRole("button", { name: "Playing" }));

    expect(onChange).toHaveBeenLastCalledWith({ ...base, progress: ["playing", "completed"] });
  });

  it("reports an ownership toggle and an untoggle back to none", async () => {
    const onChange = setupToggles({ ...EMPTY_FILTERS, ownership: ["owned"] });

    await userEvent.click(screen.getByRole("button", { name: "Watchlist" }));
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_FILTERS, ownership: ["watchlist", "owned"] });

    await userEvent.click(screen.getByRole("button", { name: "Owned" }));
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_FILTERS, ownership: [] });
  });

  it("dims values absent from the meta payload but keeps them clickable", async () => {
    const onChange = setupToggles(EMPTY_FILTERS, {
      ...meta,
      ownership: ["owned"],
      progress: ["playing", "completed"],
    });

    expect(screen.getByRole("button", { name: "Playing" })).not.toHaveAttribute("data-dimmed");
    expect(screen.getByRole("button", { name: "100%" })).not.toHaveAttribute("data-dimmed");
    expect(screen.getByRole("button", { name: "Paused" })).toHaveAttribute("data-dimmed", "true");
    expect(screen.getByRole("button", { name: "Not started" })).toHaveAttribute("data-dimmed", "true");
    expect(screen.getByRole("button", { name: "Owned" })).not.toHaveAttribute("data-dimmed");
    expect(screen.getByRole("button", { name: "Watchlist" })).toHaveAttribute("data-dimmed", "true");
    expect(screen.getByRole("button", { name: "Paused" })).toHaveAttribute("aria-description", "No games");
    expect(screen.getByRole("button", { name: "Playing" })).not.toHaveAttribute("aria-description");

    await userEvent.click(screen.getByRole("button", { name: "Paused" }));
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_FILTERS, progress: ["paused"] });
  });

  it("dims nothing while the meta payload is loading", () => {
    setupToggles(EMPTY_FILTERS, null);

    for (const button of screen.getAllByRole("button")) expect(button).not.toHaveAttribute("data-dimmed");
  });
});
