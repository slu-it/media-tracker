import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { celeste, hades } from "../../../test/fixtures/games";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { WatchlistGameCard } from "./WatchlistGameCard";

describe("WatchlistGameCard", () => {
  it("shows the formatted release date when one is set", () => {
    const dated = { ...hades, releaseDate: "2020-09-17" };
    renderWithProviders(<WatchlistGameCard game={dated} onOpen={() => {}} />);
    expect(screen.getByText("2020-09-17")).toBeInTheDocument();
    // The explicit aria-label on the card's button would otherwise hide the date from screen readers; wired as
    // an accessible description instead (see MediaCardShell), so it is still announced alongside the title.
    expect(screen.getByRole("button", { name: "Hades" })).toHaveAccessibleDescription("2020-09-17");
  });

  it("falls back to the release year when no release date is set", () => {
    renderWithProviders(<WatchlistGameCard game={hades} onOpen={() => {}} />);
    expect(screen.getByText(String(hades.releaseYear))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hades" })).toHaveAccessibleDescription(String(hades.releaseYear));
  });

  it("shows the cover in grayscale at half opacity, every card here is a watchlist game", () => {
    renderWithProviders(<WatchlistGameCard game={hades} onOpen={() => {}} />);
    // eslint-disable-next-line testing-library/no-node-access -- the sized frame isn't exposed via any ARIA role
    const frame = screen.getByTitle("No cover image").closest("div");
    expect(frame).toHaveStyle({ filter: "grayscale(1)", opacity: "0.5" });
  });

  it("shows no platform chips or status icons", () => {
    renderWithProviders(<WatchlistGameCard game={celeste} onOpen={() => {}} />);
    expect(screen.queryByText("Nintendo")).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("opens the game when the card is clicked", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    renderWithProviders(<WatchlistGameCard game={hades} onOpen={onOpen} />);

    await user.click(screen.getByRole("button", { name: "Hades" }));
    expect(onOpen).toHaveBeenCalledWith(hades);
  });
});
