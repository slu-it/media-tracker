import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  celeste,
  hades,
  hadesExpansion1,
  hadesExpansions,
  supergiantGames,
  teamCherry,
} from "../../../test/fixtures/games";
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

  it("shows the owned icon and the progress icon for an owned game", () => {
    renderWithProviders(
      <GameDetails
        game={celeste}
        titleId="title"
        expansions={[]}
        onSelectExpansion={() => {}}
        onMoveExpansion={() => {}}
      />,
    );
    expect(screen.getByRole("img", { name: "Owned" })).toBeInTheDocument();
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

  it("shows developer chips after the platforms when the game has developers", () => {
    const withDevelopers = { ...celeste, developers: [teamCherry, supergiantGames] };
    renderWithProviders(
      <GameDetails
        game={withDevelopers}
        titleId="title"
        expansions={[]}
        onSelectExpansion={() => {}}
        onMoveExpansion={() => {}}
      />,
    );
    const platformChip = screen.getByText("Nintendo");
    const developerChip = screen.getByText(teamCherry.name);
    expect(platformChip.compareDocumentPosition(developerChip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText(supergiantGames.name)).toBeInTheDocument();
  });

  it("shows no developers field for a game without developers", () => {
    renderWithProviders(
      <GameDetails
        game={celeste}
        titleId="title"
        expansions={[]}
        onSelectExpansion={() => {}}
        onMoveExpansion={() => {}}
      />,
    );
    expect(screen.queryByText("Developers")).not.toBeInTheDocument();
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

  it("shows the choose-cover button for a game without a cover and forwards a click", async () => {
    const user = userEvent.setup();
    const onPickCover = vi.fn();
    renderWithProviders(
      <GameDetails
        game={hades}
        titleId="title"
        expansions={[]}
        onSelectExpansion={() => {}}
        onMoveExpansion={() => {}}
        onPickCover={onPickCover}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Choose a cover image" }));
    expect(onPickCover).toHaveBeenCalledOnce();
  });

  it("shows the choose-cover button for a game with a cover and forwards a click", async () => {
    const user = userEvent.setup();
    const onPickCover = vi.fn();
    renderWithProviders(
      <GameDetails
        game={celeste}
        titleId="title"
        expansions={[]}
        onSelectExpansion={() => {}}
        onMoveExpansion={() => {}}
        onPickCover={onPickCover}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Choose a cover image" }));
    expect(onPickCover).toHaveBeenCalledOnce();
  });

  it("shows no choose-cover button when onPickCover is not given", () => {
    renderWithProviders(
      <GameDetails
        game={celeste}
        titleId="title"
        expansions={[]}
        onSelectExpansion={() => {}}
        onMoveExpansion={() => {}}
      />,
    );
    expect(screen.queryByRole("button", { name: "Choose a cover image" })).not.toBeInTheDocument();
  });

  it("shows the progress toggle bar under the rating in the cover column only when onProgressChange is given", () => {
    const onProgressChange = vi.fn();
    const { unmount } = renderWithProviders(
      <GameDetails
        game={celeste}
        titleId="title"
        expansions={[]}
        onSelectExpansion={() => {}}
        onMoveExpansion={() => {}}
        onProgressChange={onProgressChange}
      />,
    );
    const rating = screen.getByRole("group", { name: "Rating" });
    const bar = screen.getByRole("group", { name: "Progress" });
    // eslint-disable-next-line testing-library/no-node-access -- structural layout check, no query alternative
    expect(bar.parentElement!.parentElement).toBe(rating.parentElement);
    expect(screen.getAllByRole("group", { name: "Progress" })).toHaveLength(1);
    expect(screen.getByText("Progress")).toBeInTheDocument();
    expect(screen.getByText("Rating")).toBeInTheDocument();
    expect(rating.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    unmount();

    renderWithProviders(
      <GameDetails
        game={celeste}
        titleId="title"
        expansions={[]}
        onSelectExpansion={() => {}}
        onMoveExpansion={() => {}}
      />,
    );
    expect(screen.queryByRole("group", { name: "Progress" })).not.toBeInTheDocument();
  });

  it("shows the ownership toggle bar between the rating and the progress bar only when onOwnershipChange is given", () => {
    const onOwnershipChange = vi.fn();
    const { unmount } = renderWithProviders(
      <GameDetails
        game={celeste}
        titleId="title"
        expansions={[]}
        onSelectExpansion={() => {}}
        onMoveExpansion={() => {}}
        onOwnershipChange={onOwnershipChange}
        onProgressChange={() => {}}
      />,
    );
    const rating = screen.getByRole("group", { name: "Rating" });
    const ownership = screen.getByRole("group", { name: "Ownership" });
    const progress = screen.getByRole("group", { name: "Progress" });
    expect(screen.getByRole("button", { name: "Owned" })).toHaveAttribute("aria-pressed", "true");
    expect(rating.compareDocumentPosition(ownership) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(ownership.compareDocumentPosition(progress) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    unmount();

    renderWithProviders(
      <GameDetails
        game={celeste}
        titleId="title"
        expansions={[]}
        onSelectExpansion={() => {}}
        onMoveExpansion={() => {}}
      />,
    );
    expect(screen.queryByRole("button", { name: "Owned" })).not.toBeInTheDocument();
  });

  it("emits the clicked ownership and nothing while quickSaveBusy", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onOwnershipChange = vi.fn();
    const base = {
      game: celeste,
      titleId: "title",
      expansions: [],
      onSelectExpansion: () => {},
      onMoveExpansion: () => {},
      onOwnershipChange,
    };
    const { unmount } = renderWithProviders(<GameDetails {...base} />);
    await user.click(screen.getByRole("button", { name: "Watchlist" }));
    expect(onOwnershipChange).toHaveBeenCalledExactlyOnceWith("watchlist");
    unmount();

    onOwnershipChange.mockClear();
    renderWithProviders(<GameDetails {...base} quickSaveBusy />);
    expect(screen.getByRole("group", { name: "Ownership" })).toHaveAttribute("aria-busy", "true");
    await user.click(screen.getByRole("button", { name: "Watchlist" }));
    expect(onOwnershipChange).not.toHaveBeenCalled();
  });

  describe("rating", () => {
    const base = {
      game: celeste,
      titleId: "title",
      expansions: [],
      onSelectExpansion: () => {},
      onMoveExpansion: () => {},
    };

    it("has radio stars when onRatingChange is given and read-only stars without", () => {
      const { unmount } = renderWithProviders(<GameDetails {...base} onRatingChange={() => {}} />);
      expect(screen.getAllByRole("radio").length).toBeGreaterThan(0);
      unmount();
      renderWithProviders(<GameDetails {...base} />);
      expect(screen.queryAllByRole("radio")).toHaveLength(0);
    });

    it("emits the clicked value", () => {
      const onRatingChange = vi.fn();
      renderWithProviders(<GameDetails {...base} game={{ ...celeste, rating: 2 }} onRatingChange={onRatingChange} />);
      fireEvent.click(screen.getByRole("radio", { name: "4 Stars" }), { clientX: 1, clientY: 1 });
      expect(onRatingChange).toHaveBeenCalledExactlyOnceWith(4);
    });

    it("marks the rating group aria-busy and emits nothing while quickSaveBusy", () => {
      const onRatingChange = vi.fn();
      renderWithProviders(
        <GameDetails {...base} game={{ ...celeste, rating: 2 }} onRatingChange={onRatingChange} quickSaveBusy />,
      );
      expect(screen.getByRole("group", { name: "Rating" })).toHaveAttribute("aria-busy", "true");
      fireEvent.click(screen.getByRole("radio", { name: "4 Stars" }), { clientX: 1, clientY: 1 });
      expect(onRatingChange).not.toHaveBeenCalled();
    });
  });
});
