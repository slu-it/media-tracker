import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { celeste, hades } from "../../../test/fixtures/games";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { RankingGameCard } from "./RankingGameCard";

/** Locates the cover frame the same way whether the fixture has a cover image or shows the placeholder. */
function coverFrame(cardName: string): HTMLElement {
  const button = screen.getByRole("button", { name: cardName });
  // eslint-disable-next-line testing-library/no-node-access -- the cover (image or placeholder icon) has no shared ARIA role
  const cover = button.querySelector("img, svg");
  expect(cover).not.toBeNull();
  // eslint-disable-next-line testing-library/no-node-access -- the sized frame isn't exposed via any ARIA role
  const frame = cover!.closest("div");
  expect(frame).not.toBeNull();
  return frame as HTMLElement;
}

describe("RankingGameCard", () => {
  it("shows the accessibly-labelled rating, no platform chips or status icons", () => {
    const rated = { ...hades, rating: 4.5 };
    renderWithProviders(<RankingGameCard game={rated} onOpen={() => {}} />);

    // MUI's Rating itself has `role="img"` (labelled "4.5 Stars"), so it is the one `img` allowed here; only
    // platform chips and the status icon row (GameCard's, absent from this card) are asserted away.
    expect(screen.getByRole("group", { name: "Rating" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "4.5 Stars" })).toBeInTheDocument();
    expect(screen.queryByText("PC")).not.toBeInTheDocument();
    // The explicit aria-label on the card's button would otherwise hide the rating from screen readers; wired
    // as an accessible description instead (see MediaCardShell), so it is still announced alongside the title.
    expect(screen.getByRole("button", { name: "Hades" })).toHaveAccessibleDescription("4.5 stars");
  });

  it("shows the cover in grayscale at half opacity for a watchlist game", () => {
    const rated = { ...hades, rating: 4.5 };
    renderWithProviders(<RankingGameCard game={rated} onOpen={() => {}} />, { realStyles: true });
    expect(coverFrame("Hades")).toHaveStyle({ filter: "grayscale(1)", opacity: "0.5" });
  });

  it("shows the cover in full color and opacity for an owned game", () => {
    const rated = { ...celeste, rating: 4.5 };
    renderWithProviders(<RankingGameCard game={rated} onOpen={() => {}} />, { realStyles: true });
    expect(coverFrame("Celeste")).not.toHaveStyle({ filter: "grayscale(1)" });
    expect(coverFrame("Celeste")).not.toHaveStyle({ opacity: "0.5" });
  });

  it("opens the game when the card is clicked", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const rated = { ...hades, rating: 4.5 };
    renderWithProviders(<RankingGameCard game={rated} onOpen={onOpen} />);

    await user.click(screen.getByRole("button", { name: "Hades" }));
    expect(onOpen).toHaveBeenCalledWith(rated);
  });
});
