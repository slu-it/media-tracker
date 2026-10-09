import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { celeste, hades } from "../../../test/fixtures/games";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { GameCard } from "./GameCard";

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

describe("GameCard", () => {
  it("shows only the watchlist icon (no progress) after the title in document order", () => {
    renderWithProviders(<GameCard game={hades} onOpen={() => {}} />);
    const title = screen.getByText("Hades");
    const icon = screen.getByRole("img", { name: "Watchlist" });
    expect(title.compareDocumentPosition(icon) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole("img", { name: "100%" })).not.toBeInTheDocument();
  });

  it("shows no ownership icon for an owned game", () => {
    renderWithProviders(<GameCard game={celeste} onOpen={() => {}} />);
    expect(screen.queryByRole("img", { name: "Owned" })).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Playing" })).toBeInTheDocument();
  });

  it("shows the platform chips", () => {
    renderWithProviders(<GameCard game={celeste} onOpen={() => {}} />);
    expect(screen.getByText("Nintendo")).toBeInTheDocument();
  });

  it("shows the cover in grayscale at half opacity for a watchlist game", () => {
    renderWithProviders(<GameCard game={hades} onOpen={() => {}} />, { realStyles: true });
    expect(coverFrame("Hades")).toHaveStyle({ filter: "grayscale(1)", opacity: "0.5" });
  });

  it("shows the cover in full color and opacity for an owned game", () => {
    renderWithProviders(<GameCard game={celeste} onOpen={() => {}} />, { realStyles: true });
    expect(coverFrame("Celeste")).not.toHaveStyle({ filter: "grayscale(1)" });
    expect(coverFrame("Celeste")).not.toHaveStyle({ opacity: "0.5" });
  });

  it("shows the hidden icon for a hidden game", () => {
    renderWithProviders(<GameCard game={hades} onOpen={() => {}} />);
    expect(screen.getByRole("img", { name: "Hidden" })).toBeInTheDocument();
  });

  it("shows no hidden icon for a visible game", () => {
    renderWithProviders(<GameCard game={celeste} onOpen={() => {}} />);
    expect(screen.queryByRole("img", { name: "Hidden" })).not.toBeInTheDocument();
  });
});
