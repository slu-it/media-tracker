import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { celeste, hades, hadesExpansion1, hadesExpansions } from "../../../test/fixtures/games";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { GameDetails } from "./GameDetails";

describe("GameDetails", () => {
  it("shows the status icons after the title in document order", () => {
    renderWithProviders(
      <GameDetails
        game={hades}
        titleId="title"
        expansions={[]}
        onSelectExpansion={() => {}}
        onMoveExpansion={() => {}}
      />,
    );
    const title = screen.getByRole("heading", { name: "Hades" });
    const icon = screen.getByRole("img", { name: "Watchlist" });
    expect(title.compareDocumentPosition(icon) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("img", { name: "100%" })).toBeInTheDocument();
  });

  it("shows no ownership icon for an owned game", () => {
    renderWithProviders(
      <GameDetails
        game={celeste}
        titleId="title"
        expansions={[]}
        onSelectExpansion={() => {}}
        onMoveExpansion={() => {}}
      />,
    );
    expect(screen.queryByRole("img", { name: "Owned" })).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Playing" })).toBeInTheDocument();
  });

  it("renders no read-only checkbox in view mode", () => {
    renderWithProviders(
      <GameDetails
        game={hades}
        titleId="title"
        expansions={[]}
        onSelectExpansion={() => {}}
        onMoveExpansion={() => {}}
      />,
    );
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("shows the hidden icon for a hidden game", () => {
    renderWithProviders(
      <GameDetails
        game={hades}
        titleId="title"
        expansions={[]}
        onSelectExpansion={() => {}}
        onMoveExpansion={() => {}}
      />,
    );
    expect(screen.getByRole("img", { name: "Hidden" })).toBeInTheDocument();
  });

  it("shows no hidden icon for a visible game", () => {
    renderWithProviders(
      <GameDetails
        game={celeste}
        titleId="title"
        expansions={[]}
        onSelectExpansion={() => {}}
        onMoveExpansion={() => {}}
      />,
    );
    expect(screen.queryByRole("img", { name: "Hidden" })).not.toBeInTheDocument();
  });

  it("shows no expansions heading when there are none", () => {
    renderWithProviders(
      <GameDetails
        game={hades}
        titleId="title"
        expansions={[]}
        onSelectExpansion={() => {}}
        onMoveExpansion={() => {}}
      />,
    );
    expect(screen.queryByText("Expansions")).not.toBeInTheDocument();
  });

  it("shows the expansion list below the platform chips and forwards a click", async () => {
    const user = userEvent.setup();
    const onSelectExpansion = vi.fn();
    renderWithProviders(
      <GameDetails
        game={hades}
        titleId="title"
        expansions={hadesExpansions}
        onSelectExpansion={onSelectExpansion}
        onMoveExpansion={() => {}}
      />,
    );
    const platformChips = screen.getByText("PC");
    const expansionsHeading = screen.getByText("Expansions");
    expect(platformChips.compareDocumentPosition(expansionsHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await user.click(screen.getByRole("button", { name: hadesExpansion1.title }));
    expect(onSelectExpansion).toHaveBeenCalledExactlyOnceWith(hadesExpansion1);
  });
});
