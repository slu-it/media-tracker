import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { celeste, hades } from "../../../test/fixtures/games";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { GameCard } from "./GameCard";

describe("GameCard", () => {
  it("shows the status icons after the title in document order", () => {
    renderWithProviders(<GameCard game={hades} onOpen={() => {}} />);
    const title = screen.getByText("Hades");
    const icon = screen.getByRole("img", { name: "Watchlist" });
    expect(title.compareDocumentPosition(icon) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("img", { name: "100%" })).toBeInTheDocument();
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

  it("shows the hidden icon for a hidden game", () => {
    renderWithProviders(<GameCard game={hades} onOpen={() => {}} />);
    expect(screen.getByRole("img", { name: "Hidden" })).toBeInTheDocument();
  });

  it("shows no hidden icon for a visible game", () => {
    renderWithProviders(<GameCard game={celeste} onOpen={() => {}} />);
    expect(screen.queryByRole("img", { name: "Hidden" })).not.toBeInTheDocument();
  });
});
