import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import i18n from "../../../i18n";
import { celeste, hades, hadesSeries } from "../../../test/fixtures/games";
import type { GameResponse } from "../../../types/api";
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

const threeSeries: GameResponse = {
  ...celeste,
  series: [
    { id: "series-9", name: "Cosmere", position: null },
    { id: hadesSeries.id, name: "Mistborn Saga", position: 4 },
    { id: "series-10", name: "Wax and Wayne", position: 1 },
  ],
};

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

  it("shows only the primary series chip, the lowest position", () => {
    renderWithProviders(<GameCard game={threeSeries} onOpen={() => {}} />);
    expect(screen.getByText("Wax and Wayne #1")).toBeInTheDocument();
    expect(screen.queryByText(/Cosmere/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Mistborn Saga/)).not.toBeInTheDocument();
  });

  it("places the title after the cover, then the series chip and the platform chip", () => {
    renderWithProviders(<GameCard game={threeSeries} onOpen={() => {}} />);
    const chip = screen.getByText("Wax and Wayne #1");
    const platform = screen.getByText("Nintendo");
    const title = screen.getByRole("heading", { level: 3, name: "Celeste" });
    expect(title.compareDocumentPosition(chip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(chip.compareDocumentPosition(platform) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const status = screen.getByRole("img", { name: "Playing" });
    expect(platform.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("announces the series and platform chips as the card description", () => {
    renderWithProviders(<GameCard game={threeSeries} onOpen={() => {}} />);
    expect(screen.getByRole("button", { name: "Celeste" })).toHaveAccessibleDescription("Wax and Wayne #1 Nintendo");
  });

  it("reserves a hidden placeholder and shows no chip for a game without series", () => {
    renderWithProviders(<GameCard game={celeste} onOpen={() => {}} />, { realStyles: true });
    const button = screen.getByRole("button", { name: "Celeste" });
    expect(button).toHaveAccessibleDescription("Nintendo");
    const describedBy = button.getAttribute("aria-describedby") as string;
    // eslint-disable-next-line testing-library/no-node-access -- the placeholder has no role or text
    const placeholder = document.getElementById(describedBy)?.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(placeholder).toHaveAttribute("aria-hidden", "true");
    expect(placeholder).toHaveStyle({ visibility: "hidden" });
    expect(placeholder).toBeEmptyDOMElement();
  });

  it("formats the series chip position in German", async () => {
    await i18n.changeLanguage("de");
    const game = { ...celeste, series: [{ id: hadesSeries.id, name: "Hades", position: 2.5 }] };
    renderWithProviders(<GameCard game={game} onOpen={() => {}} />);
    expect(screen.getByText("Hades #2,5")).toBeInTheDocument();
  });

  it("shows the series position badge only for a number", () => {
    const { unmount } = renderWithProviders(<GameCard game={celeste} onOpen={() => {}} seriesPosition={2.5} />);
    expect(screen.getByText("#2.5")).toBeInTheDocument();
    unmount();
    const { unmount: unmountNull } = renderWithProviders(
      <GameCard game={celeste} onOpen={() => {}} seriesPosition={null} />,
    );
    expect(screen.queryByText(/^#/)).not.toBeInTheDocument();
    unmountNull();
    renderWithProviders(<GameCard game={celeste} onOpen={() => {}} />);
    expect(screen.queryByText(/^#/)).not.toBeInTheDocument();
  });

  it("places the series position badge above the cover and announces it", () => {
    renderWithProviders(<GameCard game={celeste} onOpen={() => {}} seriesPosition={2.5} />);
    const badge = screen.getByText("#2.5");
    // eslint-disable-next-line testing-library/no-node-access -- the decorative cover (alt="") has no ARIA role
    const cover = screen.getByRole("button", { name: "Celeste" }).querySelector("img");
    expect(cover).not.toBeNull();
    expect(badge.compareDocumentPosition(cover as Element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("button", { name: "Celeste" })).toHaveAccessibleDescription("#2.5");
  });

  it("reserves an invisible, unannounced placeholder for a null position", () => {
    renderWithProviders(<GameCard game={celeste} onOpen={() => {}} seriesPosition={null} />, { realStyles: true });
    const button = screen.getByRole("button", { name: "Celeste" });
    expect(button).toHaveAccessibleDescription("");
    const describedBy = button.getAttribute("aria-describedby") as string;
    // eslint-disable-next-line testing-library/no-node-access -- the placeholder has no role or text
    const placeholder = document.getElementById(describedBy)?.firstElementChild as HTMLElement;
    expect(placeholder).toHaveAttribute("aria-hidden", "true");
    expect(placeholder).toHaveStyle({ visibility: "hidden" });
    expect(placeholder).toBeEmptyDOMElement();
  });

  it("keeps the platform chips in the series view and shows no series chip", () => {
    renderWithProviders(<GameCard game={threeSeries} onOpen={() => {}} seriesPosition={1} />);
    expect(screen.getByText("Nintendo")).toBeInTheDocument();
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.queryByText("Wax and Wayne #1")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Celeste" })).toHaveAccessibleDescription("#1");
  });
});
