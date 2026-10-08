import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { hades } from "../../../test/fixtures/games";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { RankingGameCard } from "./RankingGameCard";

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

  it("opens the game when the card is clicked", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const rated = { ...hades, rating: 4.5 };
    renderWithProviders(<RankingGameCard game={rated} onOpen={onOpen} />);

    await user.click(screen.getByRole("button", { name: "Hades" }));
    expect(onOpen).toHaveBeenCalledWith(rated);
  });
});
