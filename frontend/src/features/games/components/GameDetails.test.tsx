import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { celeste, hades } from "../../../test/fixtures/games";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { GameDetails } from "./GameDetails";

describe("GameDetails", () => {
  it("shows the status icons after the title in document order", () => {
    renderWithProviders(<GameDetails game={hades} titleId="title" />);
    const title = screen.getByRole("heading", { name: "Hades" });
    const icon = screen.getByRole("img", { name: "Watchlist" });
    expect(title.compareDocumentPosition(icon) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("img", { name: "100%" })).toBeInTheDocument();
  });

  it("shows no ownership icon for an owned game", () => {
    renderWithProviders(<GameDetails game={celeste} titleId="title" />);
    expect(screen.queryByRole("img", { name: "Owned" })).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Playing" })).toBeInTheDocument();
  });

  it("renders no read-only checkbox in view mode", () => {
    renderWithProviders(<GameDetails game={hades} titleId="title" />);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("shows the hidden icon for a hidden game", () => {
    renderWithProviders(<GameDetails game={hades} titleId="title" />);
    expect(screen.getByRole("img", { name: "Hidden" })).toBeInTheDocument();
  });

  it("shows no hidden icon for a visible game", () => {
    renderWithProviders(<GameDetails game={celeste} titleId="title" />);
    expect(screen.queryByRole("img", { name: "Hidden" })).not.toBeInTheDocument();
  });
});
