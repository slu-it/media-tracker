import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import i18n from "../../../i18n";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { GameResultsBar } from "./GameResultsBar";

describe("GameResultsBar", () => {
  it("shows the singular count", () => {
    renderWithProviders(<GameResultsBar count={1} />);
    expect(screen.getByRole("status")).toHaveTextContent("1 game");
  });

  it("shows the plural count", () => {
    renderWithProviders(<GameResultsBar count={142} />);
    expect(screen.getByRole("status")).toHaveTextContent("142 games");
  });

  it("shows the German singular count", async () => {
    await i18n.changeLanguage("de");
    renderWithProviders(<GameResultsBar count={1} />);
    expect(screen.getByRole("status")).toHaveTextContent("1 Spiel");
  });

  it("shows the German plural count", async () => {
    await i18n.changeLanguage("de");
    renderWithProviders(<GameResultsBar count={142} />);
    expect(screen.getByRole("status")).toHaveTextContent("142 Spiele");
  });

  it("shows no status text while count is null but still renders children", () => {
    renderWithProviders(
      <GameResultsBar count={null}>
        <button type="button">Right slot</button>
      </GameResultsBar>,
    );
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(screen.getByRole("button", { name: "Right slot" })).toBeInTheDocument();
  });

  it("shows the count without children", () => {
    renderWithProviders(<GameResultsBar count={3} />);
    expect(screen.getByRole("status")).toHaveTextContent("3 games");
    expect(within(screen.getByRole("status")).queryByRole("button")).not.toBeInTheDocument();
  });

  it("keeps the status region mounted with the zero-count announcement when count is 0, and drops children", () => {
    renderWithProviders(
      <GameResultsBar count={0}>
        <button type="button">Right slot</button>
      </GameResultsBar>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("0 games");
    expect(screen.queryByRole("button", { name: "Right slot" })).not.toBeInTheDocument();
  });
});
