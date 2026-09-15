import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { GamePlatformResponse, GameResponse } from "../../types/api";
import { jsonResponse, mockApi } from "../../test/mockFetch";
import { renderWithProviders } from "../../test/renderWithProviders";
import { GamesView } from "./GamesView";

const nintendo: GamePlatformResponse = { id: "platform-nintendo", label: "Nintendo", associatedColor: "E60012" };
const pc: GamePlatformResponse = { id: "platform-pc", label: "PC", associatedColor: "757575" };
const platforms: GamePlatformResponse[] = [pc, nintendo];

const games: GameResponse[] = [
  {
    id: "id-1",
    title: "Celeste",
    releaseYear: 2018,
    description: null,
    rating: null,
    platforms: [nintendo],
    coverImageUrl: "https://img.example/c.png",
  },
  {
    id: "id-2",
    title: "Hades",
    releaseYear: 2020,
    description: null,
    rating: null,
    platforms: [pc],
    coverImageUrl: null,
  },
];

function pageOf(items: GameResponse[], page: number, totalItems: number) {
  return { items, page, pageSize: 50, totalItems, totalPages: Math.ceil(totalItems / 50) };
}

function mockPlatforms() {
  return jsonResponse(platforms);
}

describe("GamesView", () => {
  it("renders the grid, both pagination bars and opens the detail dialog from a card", async () => {
    const user = userEvent.setup();
    mockApi({ "GET /api/games": () => jsonResponse(pageOf(games, 1, 2)), "GET /api/game-platforms": mockPlatforms });
    renderWithProviders(<GamesView />);

    expect(await screen.findByRole("heading", { name: "Celeste" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Hades" })).toBeInTheDocument();
    expect(screen.getAllByText("1–2 of 2")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: /Hades/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Hades" })).toBeInTheDocument();
    expect(within(dialog).getByText("PC")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("requests the next page from the pagination control", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /api/games": (_call, url) => {
        const page = Number(url.searchParams.get("page"));
        return jsonResponse(pageOf(page === 1 ? games : [games[1]], page, 51));
      },
      "GET /api/game-platforms": mockPlatforms,
    });
    renderWithProviders(<GamesView />);
    expect(await screen.findByRole("heading", { name: "Celeste" })).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Go to page 2" })[0]);
    expect(await screen.findAllByText("51–51 of 51")).toHaveLength(2);
    expect(calls.map((c) => c.url).filter((url) => url.startsWith("/api/games"))).toEqual([
      "/api/games?page=1&pageSize=50",
      "/api/games?page=2&pageSize=50",
    ]);
  });

  it("shows the empty state and opens the add dialog from the FAB", async () => {
    const user = userEvent.setup();
    mockApi({ "GET /api/games": () => jsonResponse(pageOf([], 1, 0)), "GET /api/game-platforms": mockPlatforms });
    renderWithProviders(<GamesView />);
    expect(await screen.findByText(/No games yet/)).toBeInTheDocument();
    expect(screen.queryByText(/of 0/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add game" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Add game" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Save" })).toBeDisabled();
    expect(within(dialog).queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("shows an error with a retry button when loading fails", async () => {
    const user = userEvent.setup();
    let fail = true;
    mockApi({
      "GET /api/games": () =>
        fail ? jsonResponse({ error: "internal_error" }, 500) : jsonResponse(pageOf(games, 1, 2)),
      "GET /api/game-platforms": mockPlatforms,
    });
    renderWithProviders(<GamesView />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load the list.");
    fail = false;
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("heading", { name: "Celeste" })).toBeInTheDocument();
  });

  it("shows an error with a retry button when loading the platforms fails", async () => {
    const user = userEvent.setup();
    let fail = true;
    mockApi({
      "GET /api/games": () => jsonResponse(pageOf(games, 1, 2)),
      "GET /api/game-platforms": () =>
        fail ? jsonResponse({ error: "internal_error" }, 500) : jsonResponse(platforms),
    });
    renderWithProviders(<GamesView />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load the list.");
    expect(screen.getByRole("button", { name: "Add game" })).toBeDisabled();
    fail = false;
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Add game" })).toBeEnabled();
  });
});
