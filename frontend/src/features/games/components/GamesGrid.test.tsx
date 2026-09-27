import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { celeste, hades } from "../../../test/fixtures/games";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { GamesGrid } from "./GamesGrid";

describe("GamesGrid", () => {
  it("renders a GameCard per game by default", () => {
    renderWithProviders(<GamesGrid games={[celeste, hades]} onOpen={() => {}} />);

    expect(screen.getByRole("heading", { name: "Celeste" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Hades" })).toBeInTheDocument();
  });

  it("renders the games with a custom renderCard and calls onOpen from its onClick", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    renderWithProviders(
      <GamesGrid
        games={[celeste, hades]}
        onOpen={onOpen}
        renderCard={(game, onClick) => <button onClick={onClick}>{`open ${game.title}`}</button>}
      />,
    );

    expect(screen.queryByRole("heading", { name: "Celeste" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "open Hades" }));

    expect(onOpen).toHaveBeenCalledExactlyOnceWith(hades);
  });
});
